"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { probationFormSchema } from "@/lib/validation/probation";
import { computeProbationDates, resolveDisplayStatus, computeProbationAlert, type StoredProbationStatus } from "@/lib/analytics/probation";
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
        foraDoPrazo30: data.foraDoPrazo30 ?? false,
        foraDoPrazo60: data.foraDoPrazo60 ?? false,
        notes: data.notes || null,
      },
      update: {
        avaliador: data.avaliador || null,
        status30: data.status30,
        status60: data.status60,
        foraDoPrazo30: data.foraDoPrazo30 ?? false,
        foraDoPrazo60: data.foraDoPrazo60 ?? false,
        notes: data.notes || null,
      },
    });

    revalidatePath("/modulos/periodo-experiencia");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao salvar." };
  }
}

/** Quantos dias pra trás olhar pro histórico de período de experiência (2 anos é uma margem confortável). */
const HISTORICO_WINDOW_DAYS = 730;

export interface ProbationCandidate {
  id: string;
  name: string;
  registration: string;
  admissionDate: Date;
  isActive: boolean;
  position: { name: string } | null;
  costCenter: { name: string } | null;
  manager: { name: string } | null;
  probationTracking: {
    avaliador: string | null;
    status30: string;
    status60: string;
    foraDoPrazo30: boolean;
    foraDoPrazo60: boolean;
    notes: string | null;
  } | null;
}

/**
 * Busca todo mundo com admissão nos últimos ~2 anos (cobre período de
 * experiência em andamento e o histórico de quem já passou pelos 90 dias),
 * já separado em duas listas:
 * - emAndamento: ainda dentro dos 90 dias e ativo — é a lista que a liderança
 *   acompanha no dia a dia.
 * - historico: já passou dos 90 dias (aprovado, reprovado ou não avaliado) —
 *   sai da lista de acompanhamento automaticamente, mas o registro nunca é
 *   apagado, fica disponível aqui pra consulta.
 */
export async function getProbationOverview() {
  const historicoWindowStart = new Date();
  historicoWindowStart.setDate(historicoWindowStart.getDate() - HISTORICO_WINDOW_DAYS);

  const employees = await prisma.employee.findMany({
    where: { admissionDate: { gte: historicoWindowStart } },
    select: {
      id: true,
      name: true,
      registration: true,
      admissionDate: true,
      isActive: true,
      position: { select: { name: true } },
      costCenter: { select: { name: true } },
      manager: { select: { name: true } },
      probationTracking: true,
    },
    orderBy: { admissionDate: "asc" },
  });

  const now = new Date();
  const withComputed = employees.map((c) => {
    const dates = computeProbationDates(c.admissionDate);
    const status30 = resolveDisplayStatus((c.probationTracking?.status30 ?? "EM_AVALIACAO") as StoredProbationStatus, dates.checkpoint1, now);
    const status60 = resolveDisplayStatus((c.probationTracking?.status60 ?? "EM_AVALIACAO") as StoredProbationStatus, dates.checkpoint2, now);
    const { diasRestantes, alerta } = computeProbationAlert(dates.checkpoint2, status60, now);
    const emAndamento = c.isActive && now.getTime() <= dates.checkpoint2.getTime();
    return { ...c, dates, status30, status60, diasRestantes, alerta, emAndamento };
  });

  return {
    emAndamento: withComputed.filter((c) => c.emAndamento),
    historico: withComputed.filter((c) => !c.emAndamento).sort((a, b) => b.admissionDate.getTime() - a.admissionDate.getTime()),
  };
}
