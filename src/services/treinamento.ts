import { prisma } from "@/lib/prisma";
import { resolvePeriod } from "@/services/period";
import type { ExecutiveFilters } from "@/services/dashboard-executivo";

export async function getTreinamentoKpis(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);

  const records = await prisma.trainingRecord.findMany({
    where: {
      completedAt: { gte: range.start, lte: range.end },
      ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}),
    },
  });

  const totalHours = records.reduce((acc, r) => acc + r.hours, 0);
  const totalCost = records.reduce((acc, r) => acc + r.cost, 0);
  const avgEffectiveness =
    records.filter((r) => r.effectivenessScore).reduce((acc, r) => acc + (r.effectivenessScore ?? 0), 0) /
    (records.filter((r) => r.effectivenessScore).length || 1);

  const expiringSoon = await prisma.trainingRecord.count({
    where: {
      isMandatory: true,
      expiresAt: { gte: new Date(), lte: new Date(Date.now() + 30 * 86400000) },
      ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}),
    },
  });

  const activeEmployeesCount = await prisma.employee.count({
    where: { isActive: true, ...(filters.unitId ? { unitId: filters.unitId } : {}) },
  });

  return {
    totalHours,
    totalCost,
    avgEffectiveness,
    expiringSoon,
    hoursPerEmployee: activeEmployeesCount > 0 ? totalHours / activeEmployeesCount : 0,
    totalRecords: records.length,
  };
}

export async function getTrainingByTitle(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  const records = await prisma.trainingRecord.findMany({
    where: {
      completedAt: { gte: range.start, lte: range.end },
      ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}),
    },
    select: { title: true, hours: true },
  });
  const map = new Map<string, number>();
  for (const r of records) map.set(r.title, (map.get(r.title) ?? 0) + r.hours);
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value);
}

export async function getTrainingTable(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  return prisma.trainingRecord.findMany({
    where: {
      completedAt: { gte: range.start, lte: range.end },
      ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}),
    },
    include: { employee: { select: { name: true, unit: { select: { name: true } } } } },
    orderBy: { completedAt: "desc" },
    take: 50,
  });
}
