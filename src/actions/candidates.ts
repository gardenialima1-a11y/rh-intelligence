"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { candidateFormSchema } from "@/lib/validation/candidate";
import type { ActionResult } from "@/actions/employees";

const ALLOWED_ROLES = ["ADMINISTRADOR", "RH", "GESTOR"];

async function requireRecruiterAccess() {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    throw new Error("Você não tem permissão para gerenciar candidatos.");
  }
}

/**
 * Fecha a vaga sozinha quando um candidato é marcado como "Contratado":
 * muda o status para Preenchida, registra a data de fechamento, o nome de
 * quem foi contratado e a observação da negociação (se houver). Não mexe
 * em vagas que já estejam Canceladas.
 */
async function closeVacancyWithHire(vacancyId: string, candidateName: string, negotiationNotes: string | null) {
  const vacancy = await prisma.vacancy.findUnique({ where: { id: vacancyId }, select: { status: true } });
  if (!vacancy || vacancy.status === "CANCELADA") return;

  await prisma.vacancy.update({
    where: { id: vacancyId },
    data: {
      status: "PREENCHIDA",
      closedAt: new Date(),
      hiredCandidateName: candidateName,
      negotiationNotes: negotiationNotes || null,
    },
  });
}

/**
 * Registra a passagem de etapa de um candidato: fecha o registro em aberto
 * (se houver) marcando exitedAt = agora, e cria um novo registro para a
 * etapa atual com enteredAt = agora. É isso que alimenta a linha do tempo
 * do módulo de recrutamento com o tempo médio gasto em cada etapa.
 */
async function recordStageEntry(candidateId: string, stage: string) {
  await prisma.candidateStageHistory.updateMany({
    where: { candidateId, exitedAt: null },
    data: { exitedAt: new Date() },
  });
  await prisma.candidateStageHistory.create({
    data: { candidateId, stage: stage as never, enteredAt: new Date() },
  });
}

export async function createCandidate(raw: unknown): Promise<ActionResult> {
  try {
    await requireRecruiterAccess();
    const parsed = candidateFormSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    const data = parsed.data;

    const vacancy = await prisma.vacancy.findUnique({ where: { id: data.vacancyId } });
    if (!vacancy) return { success: false, error: "Vaga não encontrada." };

    const created = await prisma.candidate.create({
      data: {
        name: data.name,
        vacancyId: data.vacancyId,
        vacancy: vacancy.title,
        source: data.source,
        stage: data.stage,
        openedAt: new Date(),
        hiredAt: data.stage === "CONTRATADO" ? new Date() : null,
        rejectionReason: data.stage === "REPROVADO" ? data.rejectionReason : null,
      },
    });

    await recordStageEntry(created.id, data.stage);

    if (data.stage === "CONTRATADO") {
      await closeVacancyWithHire(data.vacancyId, data.name, data.negotiationNotes ?? null);
    }

    revalidatePath("/modulos/recrutamento");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao criar candidato." };
  }
}

export async function updateCandidate(candidateId: string, raw: unknown): Promise<ActionResult> {
  try {
    await requireRecruiterAccess();
    const parsed = candidateFormSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    const data = parsed.data;

    const vacancy = await prisma.vacancy.findUnique({ where: { id: data.vacancyId } });
    if (!vacancy) return { success: false, error: "Vaga não encontrada." };

    const existing = await prisma.candidate.findUnique({ where: { id: candidateId } });

    await prisma.candidate.update({
      where: { id: candidateId },
      data: {
        name: data.name,
        vacancyId: data.vacancyId,
        vacancy: vacancy.title,
        source: data.source,
        stage: data.stage,
        hiredAt: data.stage === "CONTRATADO" ? (existing?.hiredAt ?? new Date()) : null,
        rejectionReason: data.stage === "REPROVADO" ? data.rejectionReason : null,
      },
    });

    if (existing && existing.stage !== data.stage) {
      await recordStageEntry(candidateId, data.stage);
    }

    if (data.stage === "CONTRATADO") {
      await closeVacancyWithHire(data.vacancyId, data.name, data.negotiationNotes ?? null);
    }

    revalidatePath("/modulos/recrutamento");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao atualizar candidato." };
  }
}

export async function deleteCandidate(candidateId: string): Promise<ActionResult> {
  try {
    await requireRecruiterAccess();
    await prisma.candidate.delete({ where: { id: candidateId } });
    revalidatePath("/modulos/recrutamento");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao excluir candidato." };
  }
}

export async function getCandidatesForAdmin() {
  return prisma.candidate.findMany({
    include: { vacancyRef: { select: { id: true, title: true } } },
    orderBy: { openedAt: "desc" },
  });
}
