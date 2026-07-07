import { prisma } from "@/lib/prisma";
import type { ExecutiveFilters } from "@/services/dashboard-executivo";

const CYCLE = "PCO 2026";

export async function getClimaKpis(filters: ExecutiveFilters) {
  const responses = await prisma.climateSurveyResponse.findMany({
    where: { cycle: CYCLE, ...(filters.unitId ? { unitId: filters.unitId } : {}) },
  });

  const total = responses.length || 1;
  const favorable = responses.filter((r) => r.score >= 7).length;
  const favorability = favorable / total;

  const enpsResponses = responses.filter((r) => r.dimension === "Recomendaria a Empresa (eNPS)");
  const promoters = enpsResponses.filter((r) => r.score >= 9).length;
  const detractors = enpsResponses.filter((r) => r.score <= 6).length;
  const enps = enpsResponses.length > 0 ? ((promoters - detractors) / enpsResponses.length) * 100 : 0;

  return {
    favorability,
    enps,
    totalResponses: responses.length,
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
