import { prisma } from "@/lib/prisma";
import { FunnelStage } from "@prisma/client";
import { resolvePeriod } from "@/services/period";
import type { ExecutiveFilters } from "@/services/dashboard-executivo";

export async function getRecrutamentoKpis(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);

  const candidates = await prisma.candidate.findMany({
    where: { openedAt: { gte: range.start, lte: range.end } },
  });

  const openVacancies = new Set(
    candidates.filter((c) => c.stage !== FunnelStage.CONTRATADO && c.stage !== FunnelStage.REPROVADO).map((c) => c.vacancy)
  ).size;

  const criticalVacancies = candidates.filter((c) => c.isCritical).length;

  const hired = candidates.filter((c) => c.stage === FunnelStage.CONTRATADO && c.hiredAt);
  const avgTimeToHire =
    hired.length > 0
      ? hired.reduce((acc, c) => acc + (c.hiredAt!.getTime() - c.openedAt.getTime()) / 86400000, 0) / hired.length
      : 0;

  const avgCostToHire =
    hired.filter((c) => c.costToHire).reduce((acc, c) => acc + (c.costToHire ?? 0), 0) / (hired.filter((c) => c.costToHire).length || 1);

  return {
    totalCandidates: candidates.length,
    openVacancies,
    criticalVacancies,
    hiredCount: hired.length,
    avgTimeToHire,
    avgCostToHire,
  };
}

export interface VacancyCostRow {
  vacancy: string;
  daysOpen: number;
  isCritical: boolean;
  estimatedDailyCost: number;
  estimatedTotalCost: number;
}

/**
 * Custo de Vacância (Cost of Vacancy) — estima o custo de produtividade perdida
 * por manter uma posição em aberto, usando o ponto médio salarial do cargo
 * (acrescido de um fator de carga de ~40% para encargos/benefícios) dividido
 * por 21 dias úteis/mês, multiplicado pelos dias em aberto. Metodologia
 * simplificada padrão de mercado (SHRM/Bersin) quando não há dado de receita
 * marginal por posição.
 */
export async function getCostOfVacancy(_filters: ExecutiveFilters): Promise<VacancyCostRow[]> {
  // Nota: o modelo Candidate ainda não tem vínculo com unidade (unitId), então o
  // filtro global de unidade não se aplica a este indicador até que essa relação
  // seja adicionada ao schema. O parâmetro é mantido por consistência de assinatura
  // com os demais indicadores do módulo.
  const now = new Date();
  const [openCandidates, positions] = await Promise.all([
    prisma.candidate.findMany({
      where: { stage: { notIn: [FunnelStage.CONTRATADO, FunnelStage.REPROVADO] } },
      select: { vacancy: true, openedAt: true, isCritical: true },
    }),
    prisma.position.findMany({ select: { name: true, salaryFloor: true, salaryCeil: true } }),
  ]);

  const openByVacancy = new Map<string, { openedAt: Date; isCritical: boolean }>();
  for (const c of openCandidates) {
    const existing = openByVacancy.get(c.vacancy);
    if (!existing || c.openedAt < existing.openedAt) {
      openByVacancy.set(c.vacancy, { openedAt: c.openedAt, isCritical: c.isCritical });
    }
  }

  function positionMidpoint(p: { salaryFloor: number | null; salaryCeil: number | null }): number | null {
    if (p.salaryFloor === null && p.salaryCeil === null) return null;
    const floor = p.salaryFloor ?? p.salaryCeil ?? 0;
    const ceil = p.salaryCeil ?? p.salaryFloor ?? 0;
    return (floor + ceil) / 2;
  }

  function findPositionMidpoint(vacancyName: string): number {
    const match =
      positions.find((p) => p.name.toLowerCase() === vacancyName.toLowerCase()) ??
      positions.find((p) => vacancyName.toLowerCase().includes(p.name.toLowerCase()) || p.name.toLowerCase().includes(vacancyName.toLowerCase()));
    const matchMidpoint = match ? positionMidpoint(match) : null;
    if (matchMidpoint !== null && matchMidpoint !== undefined) return matchMidpoint;

    const allMidpoints = positions.map(positionMidpoint).filter((v): v is number => v !== null);
    return allMidpoints.length > 0 ? allMidpoints.reduce((a, b) => a + b, 0) / allMidpoints.length : 0;
  }

  const rows: VacancyCostRow[] = Array.from(openByVacancy.entries()).map(([vacancy, v]) => {
    const daysOpen = Math.max(0, Math.round((now.getTime() - v.openedAt.getTime()) / 86400000));
    const midpoint = findPositionMidpoint(vacancy);
    const loadedMonthlyCost = midpoint * 1.4;
    const dailyCost = loadedMonthlyCost / 21;
    return {
      vacancy,
      daysOpen,
      isCritical: v.isCritical,
      estimatedDailyCost: Math.round(dailyCost),
      estimatedTotalCost: Math.round(dailyCost * daysOpen),
    };
  });

  return rows.sort((a, b) => b.estimatedTotalCost - a.estimatedTotalCost);
}

export async function getFunnelByStage(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  const stages = Object.values(FunnelStage);
  const results = await Promise.all(
    stages.map(async (stage) => {
      const value = await prisma.candidate.count({
        where: { stage, openedAt: { gte: range.start, lte: range.end } },
      });
      return { name: stage, value };
    })
  );
  return results;
}

export async function getCandidatesBySource(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  const candidates = await prisma.candidate.findMany({
    where: { openedAt: { gte: range.start, lte: range.end } },
    select: { source: true },
  });
  const map = new Map<string, number>();
  for (const c of candidates) map.set(c.source, (map.get(c.source) ?? 0) + 1);
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export async function getVacanciesByRecruiterEfficiency(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  const candidates = await prisma.candidate.findMany({
    where: { openedAt: { gte: range.start, lte: range.end } },
    select: { vacancy: true, stage: true },
  });
  const map = new Map<string, { total: number; hired: number }>();
  for (const c of candidates) {
    const cur = map.get(c.vacancy) ?? { total: 0, hired: 0 };
    cur.total += 1;
    if (c.stage === FunnelStage.CONTRATADO) cur.hired += 1;
    map.set(c.vacancy, cur);
  }
  return Array.from(map.entries())
    .map(([name, v]) => ({ name, value: v.total > 0 ? Math.round((v.hired / v.total) * 100) : 0 }))
    .sort((a, b) => b.value - a.value);
}

export async function getRecrutamentoTable(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  return prisma.candidate.findMany({
    where: { openedAt: { gte: range.start, lte: range.end } },
    orderBy: { openedAt: "desc" },
    take: 50,
  });
}
