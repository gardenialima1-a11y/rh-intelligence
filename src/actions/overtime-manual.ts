"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  manualOvertimeFormSchema,
  overtimeDeleteRangeSchema,
  parseDateInputLocal,
  parseOptionalNumber,
  parseRequiredNumber,
} from "@/lib/validation/overtime-manual";
import type { ActionResult } from "@/actions/employees";

const ALLOWED_ROLES = ["ADMINISTRADOR", "RH"];
const DEFAULT_MONTHLY_HOURS = 220;
const DEFAULT_OVERTIME_MULTIPLIER = 1.5;
const DEFAULT_SCHEDULED_HOURS = 8;

async function requireHrAccess() {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    throw new Error("Você não tem permissão para gerenciar horas extras.");
  }
}

/** Estima o custo da HE pelo salário-base do colaborador na competência da data — só usado quando o valor não é digitado manualmente. Mesma regra usada na importação por planilha. */
async function estimateOvertimeCost(employeeId: string, date: Date, overtimeHours: number): Promise<number> {
  const competence = new Date(date.getFullYear(), date.getMonth(), 1);
  const entry = await prisma.payrollEntry.findUnique({
    where: { employeeId_competence: { employeeId, competence } },
    select: { baseSalary: true },
  });
  if (!entry?.baseSalary) return 0;
  const hourlyRate = entry.baseSalary / DEFAULT_MONTHLY_HOURS;
  return Math.round(hourlyRate * DEFAULT_OVERTIME_MULTIPLIER * overtimeHours * 100) / 100;
}

/**
 * Cria (ou corrige, se já existir um lançamento pro mesmo colaborador+dia)
 * um registro de hora extra digitado direto no sistema.
 */
export async function createManualOvertimeEntry(raw: unknown): Promise<ActionResult> {
  try {
    await requireHrAccess();
    const parsed = manualOvertimeFormSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    const data = parsed.data;

    const date = parseDateInputLocal(data.date);
    if (!date) return { success: false, error: "Data inválida." };

    const employee = await prisma.employee.findUnique({ where: { id: data.employeeId }, select: { id: true } });
    if (!employee) return { success: false, error: "Colaborador não encontrado." };

    const overtimeHours = parseRequiredNumber(data.overtimeHours);
    const scheduledHours = parseOptionalNumber(data.scheduledHours) ?? DEFAULT_SCHEDULED_HOURS;
    const workedHours = parseOptionalNumber(data.workedHours) ?? scheduledHours + overtimeHours;
    const manualCost = parseOptionalNumber(data.overtimeCost);
    const overtimeCost =
      manualCost != null && manualCost > 0
        ? manualCost
        : await estimateOvertimeCost(data.employeeId, date, overtimeHours);

    await prisma.timeEntry.upsert({
      where: { date_employeeId: { date, employeeId: data.employeeId } },
      create: {
        date,
        employeeId: data.employeeId,
        scheduledHours,
        workedHours,
        overtimeHours,
        overtimeCost,
        bankHoursDelta: 0,
      },
      update: {
        scheduledHours,
        workedHours,
        overtimeHours,
        overtimeCost,
      },
    });

    revalidatePath("/modulos/jornada");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao registrar a hora extra." };
  }
}

/** Exclui um único lançamento (botão de lixeira na tabela). */
export async function deleteOvertimeEntry(entryId: string): Promise<ActionResult> {
  try {
    await requireHrAccess();
    await prisma.timeEntry.delete({ where: { id: entryId } });
    revalidatePath("/modulos/jornada");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao excluir o lançamento." };
  }
}

function buildRangeWhere(data: { startDate: string; endDate: string; employeeId?: string | null }) {
  const start = parseDateInputLocal(data.startDate);
  const endDay = parseDateInputLocal(data.endDate);
  if (!start || !endDay) return null;
  const end = new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate(), 23, 59, 59, 999);
  return {
    date: { gte: start, lte: end },
    ...(data.employeeId ? { employeeId: data.employeeId } : {}),
  };
}

export interface OvertimeRangePreview {
  count: number;
  totalHours: number;
  totalCost: number;
}

/** Consulta quantos lançamentos existem no período (e o total de horas/custo), pra Gardenia conferir antes de confirmar a exclusão. */
export async function previewOvertimeRange(
  raw: unknown
): Promise<{ success: boolean; preview?: OvertimeRangePreview; error?: string }> {
  try {
    await requireHrAccess();
    const parsed = overtimeDeleteRangeSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    const where = buildRangeWhere(parsed.data);
    if (!where) return { success: false, error: "Datas inválidas." };

    const agg = await prisma.timeEntry.aggregate({
      where,
      _count: { _all: true },
      _sum: { overtimeHours: true, overtimeCost: true },
    });

    return {
      success: true,
      preview: {
        count: agg._count._all,
        totalHours: Math.round((agg._sum.overtimeHours ?? 0) * 10) / 10,
        totalCost: Math.round((agg._sum.overtimeCost ?? 0) * 100) / 100,
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao consultar o período." };
  }
}

/** Exclui em massa todos os lançamentos de HE dentro do intervalo de datas informado (e, opcionalmente, de um único colaborador). */
export async function deleteOvertimeRange(
  raw: unknown
): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
  try {
    await requireHrAccess();
    const parsed = overtimeDeleteRangeSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    const where = buildRangeWhere(parsed.data);
    if (!where) return { success: false, error: "Datas inválidas." };

    const result = await prisma.timeEntry.deleteMany({ where });

    revalidatePath("/modulos/jornada");
    return { success: true, deletedCount: result.count };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao excluir os lançamentos." };
  }
}
