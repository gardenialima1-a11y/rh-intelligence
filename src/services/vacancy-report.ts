import { prisma } from "@/lib/prisma";
import { calculateVacancySla } from "@/lib/analytics/vacancy-sla";

/**
 * Média histórica de dias até o fechamento (openedAt → closedAt) das vagas
 * já preenchidas — usada como "previsão realista" de conclusão. Quando dá,
 * usa só vagas do mesmo cargo (mais precisa); se não tiver histórico
 * suficiente pro cargo, cai pra média geral da empresa.
 */
async function getHistoricalAvgDaysToFill(positionId: string | null): Promise<number | null> {
  const filled = await prisma.vacancy.findMany({
    where: { status: "PREENCHIDA", closedAt: { not: null }, ...(positionId ? { positionId } : {}) },
    select: { openedAt: true, closedAt: true },
  });

  const pool = filled.length >= 3 || !positionId ? filled : await prisma.vacancy.findMany({
    where: { status: "PREENCHIDA", closedAt: { not: null } },
    select: { openedAt: true, closedAt: true },
  });

  if (pool.length === 0) return null;
  const totalDays = pool.reduce((acc, v) => acc + (v.closedAt!.getTime() - v.openedAt.getTime()) / 86400000, 0);
  return Math.round(totalDays / pool.length);
}

export async function getVacancyReportData(vacancyId: string) {
  const vacancy = await prisma.vacancy.findUnique({
    where: { id: vacancyId },
    include: { position: true, unit: true, candidates: { orderBy: { openedAt: "desc" } } },
  });
  if (!vacancy) return null;

  const funnelCounts: Record<string, number> = {
    TRIAGEM: 0,
    ENTREVISTA_RH: 0,
    ENTREVISTA_GESTOR: 0,
    TESTE: 0,
    PROPOSTA: 0,
    CONTRATADO: 0,
    REPROVADO: 0,
  };
  for (const c of vacancy.candidates) {
    funnelCounts[c.stage] = (funnelCounts[c.stage] ?? 0) + 1;
  }

  const sla = calculateVacancySla(vacancy);
  const historicalAvgDays = await getHistoricalAvgDaysToFill(vacancy.positionId);

  const targetDate = new Date(vacancy.openedAt.getTime() + vacancy.targetDays * 86400000);
  const forecastDate = historicalAvgDays
    ? new Date(vacancy.openedAt.getTime() + historicalAvgDays * 86400000)
    : null;

  return {
    vacancy,
    candidates: vacancy.candidates,
    funnelCounts,
    sla,
    targetDate,
    historicalAvgDays,
    forecastDate,
  };
}

export interface ClosedVacancyRow {
  id: string;
  title: string;
  positionName: string | null;
  unitName: string | null;
  status: "PREENCHIDA" | "CANCELADA";
  openedAt: Date;
  closedAt: Date | null;
  daysToClose: number | null;
  hiredCandidateName: string | null;
  negotiationNotes: string | null;
}

/** Histórico de vagas já fechadas (preenchidas ou canceladas), mais recentes primeiro. */
export async function getClosedVacanciesHistory(): Promise<ClosedVacancyRow[]> {
  const vacancies = await prisma.vacancy.findMany({
    where: { status: { in: ["PREENCHIDA", "CANCELADA"] } },
    include: { position: true, unit: true },
    orderBy: { closedAt: "desc" },
  });

  return vacancies.map((v) => ({
    id: v.id,
    title: v.title,
    positionName: v.position?.name ?? null,
    unitName: v.unit?.name ?? null,
    status: v.status as "PREENCHIDA" | "CANCELADA",
    openedAt: v.openedAt,
    closedAt: v.closedAt,
    daysToClose: v.closedAt ? Math.round((v.closedAt.getTime() - v.openedAt.getTime()) / 86400000) : null,
    hiredCandidateName: v.hiredCandidateName,
    negotiationNotes: v.negotiationNotes,
  }));
}
