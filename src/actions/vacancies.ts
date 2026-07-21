"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { vacancyFormSchema, parseTargetDays } from "@/lib/validation/vacancy";
import type { ActionResult } from "@/actions/employees";

const ALLOWED_ROLES = ["ADMINISTRADOR", "RH", "GESTOR"];

async function requireRecruiterAccess() {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    throw new Error("Você não tem permissão para gerenciar vagas.");
  }
}

export async function createVacancy(raw: unknown): Promise<ActionResult> {
  try {
    await requireRecruiterAccess();
    const parsed = vacancyFormSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    const data = parsed.data;

    await prisma.vacancy.create({
      data: {
        title: data.title,
        positionId: data.positionId || null,
        unitId: data.unitId || null,
        status: data.status,
        isCritical: data.isCritical,
        targetDays: parseTargetDays(data.targetDays),
        openedAt: new Date(data.openedAt),
        closedAt: data.closedAt ? new Date(data.closedAt) : null,
        notes: data.notes || null,
      },
    });

    revalidatePath("/modulos/recrutamento");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao criar vaga." };
  }
}

export async function updateVacancy(vacancyId: string, raw: unknown): Promise<ActionResult> {
  try {
    await requireRecruiterAccess();
    const parsed = vacancyFormSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    const data = parsed.data;

    await prisma.vacancy.update({
      where: { id: vacancyId },
      data: {
        title: data.title,
        positionId: data.positionId || null,
        unitId: data.unitId || null,
        status: data.status,
        isCritical: data.isCritical,
        targetDays: parseTargetDays(data.targetDays),
        openedAt: new Date(data.openedAt),
        closedAt: data.closedAt ? new Date(data.closedAt) : null,
        notes: data.notes || null,
      },
    });

    revalidatePath("/modulos/recrutamento");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao atualizar vaga." };
  }
}

export async function deleteVacancy(vacancyId: string): Promise<ActionResult> {
  try {
    await requireRecruiterAccess();
    await prisma.vacancy.delete({ where: { id: vacancyId } });
    revalidatePath("/modulos/recrutamento");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao excluir vaga." };
  }
}

export async function getVacancies() {
  return prisma.vacancy.findMany({
    include: { position: true, unit: true, _count: { select: { candidates: true } } },
    orderBy: [{ status: "asc" }, { openedAt: "desc" }],
  });
}
