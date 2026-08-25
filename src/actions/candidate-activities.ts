"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { candidateActivityFormSchema } from "@/lib/validation/candidate-activity";
import type { ActionResult } from "@/actions/employees";

const ALLOWED_ROLES = ["ADMINISTRADOR", "RH", "GESTOR"];

async function requireRecruiterAccess() {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    throw new Error("Você não tem permissão para registrar atividades de recrutamento.");
  }
}

/**
 * Registra um contato/interação com um candidato (ligação, entrevista,
 * e-mail...), independente da etapa do funil em que ele está — é isso que
 * alimenta os indicadores de "quantas entrevistas fiz" e "com quantas
 * pessoas conversei" no relatório mensal para a diretoria.
 */
export async function logCandidateActivity(raw: unknown): Promise<ActionResult> {
  try {
    await requireRecruiterAccess();
    const parsed = candidateActivityFormSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    const data = parsed.data;

    const candidate = await prisma.candidate.findUnique({ where: { id: data.candidateId }, select: { id: true } });
    if (!candidate) return { success: false, error: "Candidato não encontrado." };

    await prisma.candidateActivity.create({
      data: {
        candidateId: data.candidateId,
        type: data.type,
        occurredAt: new Date(data.occurredAt),
        notes: data.notes?.trim() || null,
      },
    });

    revalidatePath("/modulos/recrutamento");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao registrar atividade." };
  }
}

export async function deleteCandidateActivity(activityId: string): Promise<ActionResult> {
  try {
    await requireRecruiterAccess();
    await prisma.candidateActivity.delete({ where: { id: activityId } });
    revalidatePath("/modulos/recrutamento");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao excluir atividade." };
  }
}

/** Últimas atividades registradas, mais recentes primeiro — usado no feed "Atividades recentes". */
export async function getRecentActivities(limit = 20) {
  return prisma.candidateActivity.findMany({
    include: { candidate: { select: { id: true, name: true, vacancy: true } } },
    orderBy: { occurredAt: "desc" },
    take: limit,
  });
}
