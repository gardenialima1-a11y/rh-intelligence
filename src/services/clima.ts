import { prisma } from "@/lib/prisma";
import type { ExecutiveFilters } from "@/services/dashboard-executivo";

const CYCLE = "PCO 2026";

export async function getClimaKpis(filters: ExecutiveFilters) {
  const [responses, meta] = await Promise.all([
    prisma.climateSurveyResponse.findMany({
      where: { cycle: CYCLE, ...(filters.unitId ? { unitId: filters.unitId } : {}) },
    }),
    prisma.surveyCycleMeta.findUnique({ where: { cycle: CYCLE } }),
  ]);

  const total = responses.length || 1;
  const favorable = responses.filter((r) => r.score >= 7).length;
  const favorability = favorable / total;

  const enpsResponses = responses.filter((r) => r.dimension === "Recomendaria a Empresa (eNPS)");
  const promoters = enpsResponses.filter((r) => r.score >= 9).length;
  const detractors = enpsResponses.filter((r) => r.score <= 6).length;
  const enps = enpsResponses.length > 0 ? ((promoters - detractors) / enpsResponses.length) * 100 : 0;

  const totalRespondents = meta?.totalRespondents ?? enpsResponses.length;
  const totalInvited = meta?.totalInvited ?? null;
  const participationRate = totalInvited ? totalRespondents / totalInvited : null;

  return {
    favorability,
    enps,
    totalResponses: responses.length,
    totalRespondents,
    totalInvited,
    participationRate,
    cycle: CYCLE,
  };
}

export async function getFavorabilityByDimension(filters: ExecutiveFilters) {
  const responses = await prisma.climateSurveyResponse.findMany({
    where: { cycle: CYCLE, ...(filters.unitId ? { unitId: filters.unitId } : {}) },
    select: { dimension: true, score: true },
  });
  const map = new Map<string, { total: number; favorable: number }>();
  for (const r of responses) {
    const cur = map.get(r.dimension) ?? { total: 0, favorable: 0 };
    cur.total += 1;
    if (r.score >= 7) cur.favorable += 1;
    map.set(r.dimension, cur);
  }
  return Array.from(map.entries())
    .map(([name, v]) => ({ name, value: Math.round((v.favorable / v.total) * 100) }))
    .sort((a, b) => b.value - a.value);
}

export async function getFavorabilityByArea(filters: ExecutiveFilters) {
  const responses = await prisma.climateSurveyResponse.findMany({
    where: { cycle: CYCLE, ...(filters.unitId ? { unitId: filters.unitId } : {}) },
    select: { area: true, score: true },
  });
  const map = new Map<string, { total: number; favorable: number }>();
  for (const r of responses) {
    const area = r.area ?? "Não informado";
    const cur = map.get(area) ?? { total: 0, favorable: 0 };
    cur.total += 1;
    if (r.score >= 7) cur.favorable += 1;
    map.set(area, cur);
  }
  return Array.from(map.entries()).map(([name, v]) => ({ name, value: Math.round((v.favorable / v.total) * 100) }));
}

export interface CycleComparisonRow {
  dimension: string;
  byCycle: Record<string, number>;
}

export interface CycleComparisonResult {
  cycles: string[];
  rows: CycleComparisonRow[];
  enpsByCycle: Record<string, number>;
}

/**
 * Compara favorabilidade por dimensão e eNPS entre todos os ciclos já
 * carregados no sistema — a visão "comparativa" entre pesquisas.
 */
export async function getCycleComparison(): Promise<CycleComparisonResult> {
  const responses = await prisma.climateSurveyResponse.findMany({
    select: { cycle: true, dimension: true, score: true, createdAt: true },
  });

  if (responses.length === 0) return { cycles: [], rows: [], enpsByCycle: {} };

  const cycleFirstSeen = new Map<string, number>();
  for (const r of responses) {
    const t = r.createdAt.getTime();
    if (!cycleFirstSeen.has(r.cycle) || t < cycleFirstSeen.get(r.cycle)!) cycleFirstSeen.set(r.cycle, t);
  }
  const cycles = Array.from(cycleFirstSeen.keys()).sort((a, b) => cycleFirstSeen.get(a)! - cycleFirstSeen.get(b)!);

  const byDimensionCycle = new Map<string, Map<string, { total: number; favorable: number }>>();
  const enpsByCycleRaw = new Map<string, { promoters: number; detractors: number; total: number }>();

  for (const r of responses) {
    if (r.dimension === "Recomendaria a Empresa (eNPS)") {
      const cur = enpsByCycleRaw.get(r.cycle) ?? { promoters: 0, detractors: 0, total: 0 };
      cur.total += 1;
      if (r.score >= 9) cur.promoters += 1;
      if (r.score <= 6) cur.detractors += 1;
      enpsByCycleRaw.set(r.cycle, cur);
      continue;
    }
    const dimMap = byDimensionCycle.get(r.dimension) ?? new Map();
    const cur = dimMap.get(r.cycle) ?? { total: 0, favorable: 0 };
    cur.total += 1;
    if (r.score >= 7) cur.favorable += 1;
    dimMap.set(r.cycle, cur);
    byDimensionCycle.set(r.dimension, dimMap);
  }

  const rows: CycleComparisonRow[] = Array.from(byDimensionCycle.entries()).map(([dimension, dimMap]) => {
    const byCycle: Record<string, number> = {};
    for (const [cycle, v] of dimMap.entries()) {
      byCycle[cycle] = Math.round((v.favorable / v.total) * 100);
    }
    return { dimension, byCycle };
  });

  const enpsByCycle: Record<string, number> = {};
  for (const [cycle, v] of enpsByCycleRaw.entries()) {
    enpsByCycle[cycle] = Math.round(((v.promoters - v.detractors) / v.total) * 100 * 10) / 10;
  }

  return { cycles, rows, enpsByCycle };
}
