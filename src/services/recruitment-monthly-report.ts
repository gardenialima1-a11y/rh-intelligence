import { prisma } from "@/lib/prisma";
import { percentDelta } from "@/services/period";
import { CONVERSATION_ACTIVITY_TYPES } from "@/lib/validation/candidate-activity";

const MONTH_LABEL_FMT = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

/** Recebe "YYYY-MM" (ou nada, cai no mês atual) e devolve o intervalo [início, fim] daquele mês. */
function resolveMonthRange(monthParam?: string): { start: Date; end: Date; year: number; month: number } {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth(); // 0-indexado

  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    year = y;
    month = m - 1;
  }

  const start = new Date(year, month, 1, 0, 0, 0, 0);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { start, end, year, month };
}

function previousMonthOf(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

export interface MonthlyRecruitmentIndicators {
  monthLabel: string;
  start: Date;
  end: Date;
  candidatesRegistered: number;
  interviewsRH: number;
  interviewsGestor: number;
  totalInterviews: number;
  peopleContacted: number;
  totalActivities: number;
  vacanciesOpened: number;
  vacanciesClosed: number;
  vacanciesCancelled: number;
  avgDaysToClose: number | null;
  hires: number;
  avgCostToHire: number | null;
  bySource: { name: string; value: number }[];
  funnelByStage: { name: string; value: number }[];
  closedVacancies: {
    title: string;
    unitName: string | null;
    daysToClose: number | null;
    hiredCandidateName: string | null;
    closedAt: Date | null;
  }[];
}

async function computeIndicators(start: Date, end: Date): Promise<MonthlyRecruitmentIndicators> {
  const [
    candidatesInPeriod,
    activitiesInPeriod,
    openedVacancies,
    closedVacanciesRaw,
    cancelledCount,
    hiredCandidates,
  ] = await Promise.all([
    prisma.candidate.findMany({
      where: { openedAt: { gte: start, lte: end } },
      select: { id: true, source: true, stage: true },
    }),
    prisma.candidateActivity.findMany({
      where: { occurredAt: { gte: start, lte: end } },
      select: { type: true, candidateId: true },
    }),
    prisma.vacancy.count({ where: { openedAt: { gte: start, lte: end } } }),
    prisma.vacancy.findMany({
      where: { status: "PREENCHIDA", closedAt: { gte: start, lte: end } },
      include: { unit: true },
    }),
    prisma.vacancy.count({ where: { status: "CANCELADA", closedAt: { gte: start, lte: end } } }),
    prisma.candidate.findMany({
      where: { stage: "CONTRATADO", hiredAt: { gte: start, lte: end } },
      select: { costToHire: true },
    }),
  ]);

  const interviewsRH = activitiesInPeriod.filter((a) => a.type === "ENTREVISTA_RH").length;
  const interviewsGestor = activitiesInPeriod.filter((a) => a.type === "ENTREVISTA_GESTOR").length;

  const conversationCandidateIds = new Set(
    activitiesInPeriod
      .filter((a) => (CONVERSATION_ACTIVITY_TYPES as string[]).includes(a.type))
      .map((a) => a.candidateId)
  );

  const bySourceMap = new Map<string, number>();
  for (const c of candidatesInPeriod) bySourceMap.set(c.source, (bySourceMap.get(c.source) ?? 0) + 1);

  const funnelMap = new Map<string, number>();
  for (const c of candidatesInPeriod) funnelMap.set(c.stage, (funnelMap.get(c.stage) ?? 0) + 1);

  const closedVacancies = closedVacanciesRaw.map((v) => ({
    title: v.title,
    unitName: v.unit?.name ?? null,
    daysToClose: v.closedAt ? Math.round((v.closedAt.getTime() - v.openedAt.getTime()) / 86400000) : null,
    hiredCandidateName: v.hiredCandidateName,
    closedAt: v.closedAt,
  }));

  const daysToCloseList = closedVacancies.map((v) => v.daysToClose).filter((d): d is number => d !== null);
  const avgDaysToClose =
    daysToCloseList.length > 0 ? Math.round(daysToCloseList.reduce((a, b) => a + b, 0) / daysToCloseList.length) : null;

  const costs = hiredCandidates.map((c) => c.costToHire).filter((c): c is number => c !== null && c !== undefined);
  const avgCostToHire = costs.length > 0 ? costs.reduce((a, b) => a + b, 0) / costs.length : null;

  return {
    monthLabel: MONTH_LABEL_FMT.format(start),
    start,
    end,
    candidatesRegistered: candidatesInPeriod.length,
    interviewsRH,
    interviewsGestor,
    totalInterviews: interviewsRH + interviewsGestor,
    peopleContacted: conversationCandidateIds.size,
    totalActivities: activitiesInPeriod.length,
    vacanciesOpened: openedVacancies,
    vacanciesClosed: closedVacancies.length,
    vacanciesCancelled: cancelledCount,
    avgDaysToClose,
    hires: hiredCandidates.length,
    avgCostToHire,
    bySource: Array.from(bySourceMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
    funnelByStage: Array.from(funnelMap.entries()).map(([name, value]) => ({ name, value })),
    closedVacancies,
  };
}

export interface MonthlyRecruitmentReport {
  current: MonthlyRecruitmentIndicators;
  previous: MonthlyRecruitmentIndicators;
  deltas: {
    candidatesRegistered: number;
    totalInterviews: number;
    peopleContacted: number;
    hires: number;
    vacanciesClosed: number;
  };
}

/**
 * Indicadores de recrutamento de um mês específico ("YYYY-MM"; sem parâmetro
 * cai no mês atual), com comparação ao mês anterior — a base do relatório
 * mensal para a reunião de indicadores com a diretoria.
 */
export async function getMonthlyRecruitmentReport(monthParam?: string): Promise<MonthlyRecruitmentReport> {
  const { start, end, year, month } = resolveMonthRange(monthParam);
  const prevRange = previousMonthOf(year, month);

  const [current, previous] = await Promise.all([
    computeIndicators(start, end),
    computeIndicators(prevRange.start, prevRange.end),
  ]);

  return {
    current,
    previous,
    deltas: {
      candidatesRegistered: percentDelta(current.candidatesRegistered, previous.candidatesRegistered),
      totalInterviews: percentDelta(current.totalInterviews, previous.totalInterviews),
      peopleContacted: percentDelta(current.peopleContacted, previous.peopleContacted),
      hires: percentDelta(current.hires, previous.hires),
      vacanciesClosed: percentDelta(current.vacanciesClosed, previous.vacanciesClosed),
    },
  };
}
