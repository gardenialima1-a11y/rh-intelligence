"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { absenceFormSchema, parseHoursLost } from "@/lib/validation/absence";
import type { ActionResult } from "@/actions/employees";

const ALLOWED_ROLES = ["ADMINISTRADOR", "RH"];

async function requireHrAccess() {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    throw new Error("Você não tem permissão para gerenciar atestados.");
  }
}

export async function createAbsence(raw: unknown): Promise<ActionResult> {
  try {
    await requireHrAccess();
    const parsed = absenceFormSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    const data = parsed.data;

    await prisma.absence.create({
      data: {
        employeeId: data.employeeId,
        date: new Date(data.date),
        reasonId: data.reasonId || null,
        cid: data.cid || null,
        hoursLost: parseHoursLost(data.hoursLost),
        hasCertificate: data.hasCertificate,
        absenceType: data.absenceType,
        returnDate: data.returnDate ? new Date(data.returnDate) : null,
        attachmentUrl: data.attachmentUrl || null,
        attachmentName: data.attachmentName || null,
      },
    });

    revalidatePath("/modulos/sst");
    revalidatePath("/modulos/absenteismo");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao criar atestado." };
  }
}

export async function updateAbsence(absenceId: string, raw: unknown): Promise<ActionResult> {
  try {
    await requireHrAccess();
    const parsed = absenceFormSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    const data = parsed.data;

    await prisma.absence.update({
      where: { id: absenceId },
      data: {
        employeeId: data.employeeId,
        date: new Date(data.date),
        reasonId: data.reasonId || null,
        cid: data.cid || null,
        hoursLost: parseHoursLost(data.hoursLost),
        hasCertificate: data.hasCertificate,
        absenceType: data.absenceType,
        returnDate: data.returnDate ? new Date(data.returnDate) : null,
        attachmentUrl: data.attachmentUrl || null,
        attachmentName: data.attachmentName || null,
      },
    });

    revalidatePath("/modulos/sst");
    revalidatePath("/modulos/absenteismo");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao atualizar atestado." };
  }
}

export async function deleteAbsence(absenceId: string): Promise<ActionResult> {
  try {
    await requireHrAccess();
    await prisma.absence.delete({ where: { id: absenceId } });
    revalidatePath("/modulos/sst");
    revalidatePath("/modulos/absenteismo");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao excluir atestado." };
  }
}

export interface AtestadoRankingRow {
  employeeId: string;
  employeeName: string;
  unitName: string;
  totalAtestados: number;
  totalHoursLost: number;
  lastOccurrence: Date;
}

/**
 * Ranking de colaboradores por quantidade de atestados e horas perdidas
 * (histórico completo, não só o período filtrado no topo da página).
 */
export async function getAtestadosRanking(): Promise<AtestadoRankingRow[]> {
  const absences = await prisma.absence.findMany({
    include: { employee: { include: { unit: true } } },
    orderBy: { date: "asc" },
  });

  const byEmployee = new Map<string, AtestadoRankingRow>();
  for (const a of absences) {
    let row = byEmployee.get(a.employeeId);
    if (!row) {
      row = {
        employeeId: a.employeeId,
        employeeName: a.employee.name,
        unitName: a.employee.unit.name,
        totalAtestados: 0,
        totalHoursLost: 0,
        lastOccurrence: a.date,
      };
      byEmployee.set(a.employeeId, row);
    }
    row.totalAtestados += 1;
    row.totalHoursLost += a.hoursLost;
    if (a.date > row.lastOccurrence) row.lastOccurrence = a.date;
  }

  return Array.from(byEmployee.values()).sort(
    (a, b) => b.totalAtestados - a.totalAtestados || b.totalHoursLost - a.totalHoursLost
  );
}

export async function getCertificatedAbsences() {
  return prisma.absence.findMany({
    where: { hasCertificate: true },
    include: { employee: { select: { id: true, name: true } }, reason: true },
    orderBy: { date: "desc" },
    take: 200,
  });
}
