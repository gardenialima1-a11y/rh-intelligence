"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { probationFormSchema } from "@/lib/validation/probation";
import type { ActionResult } from "@/actions/employees";

const ALLOWED_ROLES = ["ADMINISTRADOR", "RH"];

async function requireHrAccess() {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    throw new Error("Você não tem permissão para gerenciar o período de experiência.");
  }
}

export async function upsertProbationTracking(employeeId: string, raw: unknown): Promise<ActionResult> {
  try {
    await requireHrAccess();
    const parsed = probationFormSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    const data = parsed.data;

    await prisma.probationTracking.upsert({
      where: { employeeId },
      create: {
        employeeId,
        avaliador: data.avaliador || null,
        status30: data.status30,
        status60: data.status60,
        notes: data.notes || null,
      },
      update: {
        avaliador: data.avaliador || null,
        status30: data.status30,
        status60: data.status60,
        notes: data.notes || null,
      },
    });

    revalidatePath("/modulos/periodo-experiencia");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao salvar." };
  }
}

/**
 * Colaboradores ativos, admitidos nos últimos ~105 dias (90 do período de
 * experiência + margem), com o acompanhamento (se já existir) já anexado.
 */
export async function getProbationCandidates() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 105);

  return prisma.employee.findMany({
    where: { isActive: true, admissionDate: { gte: cutoff } },
    select: {
      id: true,
      name: true,
      registration: true,
      admissionDate: true,
      position: { select: { name: true } },
      costCenter: { select: { name: true } },
      manager: { select: { name: true } },
      probationTracking: true,
    },
    orderBy: { admissionDate: "asc" },
  });
}
