import { prisma } from "@/lib/prisma";
import { MovementType } from "@prisma/client";
import { resolvePeriod, previousPeriod, percentDelta, lastNMonthsKeys } from "@/services/period";
import { linearForecast, trendDirection } from "@/services/forecast";
import type { ExecutiveFilters } from "@/services/dashboard-executivo";

async function activeCountAt(date: Date, unitId?: string) {
  return prisma.employee.count({
    where: {
      admissionDate: { lte: date },
      OR: [{ terminationDate: null }, { terminationDate: { gt: date } }],
      ...(unitId ? { unitId } : {}),
    },
  });
}

async function avgHeadcount(start: Date, end: Date, unitId?: string) {
  const [s, e] = await Promise.all([activeCountAt(start, unitId), activeCountAt(end, unitId)]);
  return (s + e) / 2 || 1;
}

export async function getTurnoverKpis(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  const prev = previousPeriod(range);

  async function stats(start: Date, end: Date) {
    const where = {
      type: MovementType.DESLIGAMENTO,
      date: { gte: start, lte: end },
      ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}),
    };
    const [total, voluntary, involuntary, avgHc] = await Promise.all([
      prisma.movement.count({ where }),
      prisma.movement.count({ where: { ...where, voluntary: true } }),
      prisma.movement.count({ where: { ...where, voluntary: false } }),
      avgHeadcount(start, end, filters.unitId),
    ]);
    return { total, voluntary, involuntary, avgHc, rate: total / avgHc, voluntaryRate: voluntary / avgHc, involuntaryRate: involuntary / avgHc };
  }

  const [current, previous] = await Promise.all([stats(range.start, range.end), stats(prev.start, prev.end)]);

  const months = lastNMonthsKeys(12);
  const series = await Promise.all(
    months.map(async (key) => {
      const [y, m] = key.split("-").map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0, 23, 59, 59);
      const s = await stats(start, end);
      return s.rate;
    })
  );

  const costAgg = await prisma.movement.aggregate({
    _sum: { costValue: true },
    where: {
      type: MovementType.DESLIGAMENTO,
      date: { gte: range.start, lte: range.end },
      ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}),
    },
  });

  return {
    current,
    previous,
    delta: percentDelta(current.rate, previous.rate),
    series,
    totalCost: costAgg._sum.costValue ?? 0,
  };
}

export async function getTurnoverForecast(filters: ExecutiveFilters) {
  const months = lastNMonthsKeys(6);
  const series = await Promise.all(
    months.map(async (key) => {
      const [y, m] = key.split("-").map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0, 23, 59, 59);
      const where = {
        type: MovementType.DESLIGAMENTO,
        date: { gte: start, lte: end },
        ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}),
      };
      const total = await prisma.movement.count({ where });
      const avgHc = await avgHeadcount(start, end, filters.unitId);
      return (total / avgHc) * 100; // em pontos percentuais para facilitar a projeção
    })
  );

  const forecastPct = linearForecast(series, 3);
  const direction = trendDirection(series);

  return {
    historicalSeries: series,
    forecastSeries: forecastPct,
    direction,
    projectedRate3Months: (forecastPct[forecastPct.length - 1] ?? series[series.length - 1] ?? 0) / 100,
  };
}

export async function getTurnoverByManager(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  const managers = await prisma.manager.findMany({
    select: {
      name: true,
      employees: {
        select: {
          movements: {
            where: { type: MovementType.DESLIGAMENTO, date: { gte: range.start, lte: range.end } },
            select: { id: true },
          },
        },
        where: filters.unitId ? { unitId: filters.unitId } : {},
      },
    },
  });

  return managers
    .map((m) => ({
      name: m.name,
      value: m.employees.reduce((acc, e) => acc + e.movements.length, 0),
    }))
    .filter((m) => m.value > 0)
    .sort((a, b) => b.value - a.value);
}

export async function getTurnoverByReason(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  const movements = await prisma.movement.findMany({
    where: {
      type: MovementType.DESLIGAMENTO,
      date: { gte: range.start, lte: range.end },
      ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}),
    },
    include: { reason: true },
  });

  const map = new Map<string, number>();
  for (const m of movements) {
    const label = m.reason?.label ?? "Não informado";
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export async function getEarlyTurnover(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  const terminated = await prisma.employee.findMany({
    where: {
      terminationDate: { gte: range.start, lte: range.end },
      ...(filters.unitId ? { unitId: filters.unitId } : {}),
    },
    select: { admissionDate: true, terminationDate: true },
  });

  let within90 = 0;
  let withinYear = 0;
  for (const e of terminated) {
    if (!e.terminationDate) continue;
    const days = (e.terminationDate.getTime() - e.admissionDate.getTime()) / 86400000;
    if (days <= 90) within90 += 1;
    if (days <= 365) withinYear += 1;
  }

  return {
    within90,
    withinYear,
    total: terminated.length,
    within90Rate: terminated.length > 0 ? within90 / terminated.length : 0,
    withinYearRate: terminated.length > 0 ? withinYear / terminated.length : 0,
  };
}

export async function getTurnoverTable(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  return prisma.movement.findMany({
    where: {
      type: MovementType.DESLIGAMENTO,
      date: { gte: range.start, lte: range.end },
      ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}),
    },
    include: { employee: { include: { position: true, manager: true, unit: true } }, reason: true },
    orderBy: { date: "desc" },
    take: 50,
  });
}
