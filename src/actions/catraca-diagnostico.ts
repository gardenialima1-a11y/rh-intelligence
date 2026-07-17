"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { explainDayPairs, type PairExplanation } from "@/lib/analytics/turnstile";

const ALLOWED_ROLES = ["ADMINISTRADOR", "RH"];

async function requireHrAccess() {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    throw new Error("Você não tem permissão para consultar esse detalhamento.");
  }
}

export interface CatracaDayDetail {
  employeeName: string;
  events: { timestamp: string; direction: string }[];
  pairs: PairExplanation[];
  totalMinutes: number;
}

export async function getCatracaDayDetail(
  employeeSearch: string,
  dateStr: string
): Promise<{ success: boolean; detail?: CatracaDayDetail; error?: string }> {
  try {
    await requireHrAccess();

    const employee = await prisma.employee.findFirst({
      where: { name: { contains: employeeSearch, mode: "insensitive" } },
      select: { id: true, name: true },
    });
    if (!employee) {
      return { success: false, error: "Nenhum colaborador encontrado com esse nome." };
    }

    const day = new Date(dateStr + "T00:00:00");
    const nextDay = new Date(day);
    nextDay.setDate(nextDay.getDate() + 1);

    const events = await prisma.turnstileEvent.findMany({
      where: { employeeId: employee.id, timestamp: { gte: day, lt: nextDay } },
      orderBy: { timestamp: "asc" },
      select: { timestamp: true, direction: true },
    });

    if (events.length === 0) {
      return { success: false, error: `Nenhum registro de catraca encontrado para ${employee.name} nesse dia.` };
    }

    const pairs = explainDayPairs(events.map((e) => ({ employeeId: employee.id, timestamp: e.timestamp, direction: e.direction })));
    const totalMinutes = pairs.reduce((acc, p) => acc + p.countedMinutes, 0);

    return {
      success: true,
      detail: {
        employeeName: employee.name,
        events: events.map((e) => ({ timestamp: e.timestamp.toISOString(), direction: e.direction })),
        pairs,
        totalMinutes,
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao consultar." };
  }
}
