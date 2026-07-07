import { prisma } from "@/lib/prisma";
import { resolvePeriod } from "@/services/period";
import type { ExecutiveFilters } from "@/services/dashboard-executivo";

export async function getSstKpis(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  const where = {
    date: { gte: range.start, lte: range.end },
    ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}),
  };

  const incidents = await prisma.safetyIncident.findMany({ where });
  const accidents = incidents.filter((i) => i.type === "ACIDENTE");
  const nearMisses = incidents.filter((i) => i.type === "NEAR_MISS");
  const withCAT = incidents.filter((i) => i.hasCAT).length;
  const totalDaysLost = incidents.reduce((acc, i) => acc + i.daysLost, 0);

  const activeEmployees = await prisma.employee.count({
    where: { isActive: true, ...(filters.unitId ? { unitId: filters.unitId } : {}) },
  });

  // taxas ilustrativas por milhão de horas trabalhadas (HHT estimado)
  const estimatedHHT = activeEmployees * 8 * 22 * (range.months || 1);
  const frequencyRate = estimatedHHT > 0 ? (accidents.length * 1_000_000) / estimatedHHT : 0;
  const severityRate = estimatedHHT > 0 ? (totalDaysLost * 1_000_000) / estimatedHHT : 0;

  return {
    accidentsCount: accidents.length,
    nearMissesCount: nearMisses.length,
    withCAT,
    totalDaysLost,
    frequencyRate,
    severityRate,
  };
}

export async function getIncidentsTable(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  return prisma.safetyIncident.findMany({
    where: {
      date: { gte: range.start, lte: range.end },
      ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}),
    },
    include: { employee: { select: { name: true, unit: { select: { name: true } } } } },
    orderBy: { date: "desc" },
    take: 50,
  });
}

export async function getIncidentsByType(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  const incidents = await prisma.safetyIncident.findMany({
    where: {
      date: { gte: range.start, lte: range.end },
      ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}),
    },
    select: { type: true },
  });
  const map = new Map<string, number>();
  for (const i of incidents) map.set(i.type, (map.get(i.type) ?? 0) + 1);
  return Array.from(map.entries()).map(([name, value]) => ({ name: name === "ACIDENTE" ? "Acidente" : "Near Miss", value }));
}
