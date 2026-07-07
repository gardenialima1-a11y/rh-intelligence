import { prisma } from "@/lib/prisma";
import { MovementType } from "@prisma/client";
import { resolvePeriod, previousPeriod, percentDelta, lastNMonthsKeys } from "@/services/period";
import type { ExecutiveFilters } from "@/services/dashboard-executivo";

export async function getDesligamentosKpis(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  const prev = previousPeriod(range);

  const baseWhere = (start: Date, end: Date) => ({
    type: MovementType.DESLIGAMENTO,
    date: { gte: start, lte: end },
    ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}),
  });

  const [current, previous, costAgg, voluntaryCount, involuntaryCount] = await Promise.all([
    prisma.movement.count({ where: baseWhere(range.start, range.end) }),
    prisma.movement.count({ where: baseWhere(prev.start, prev.end) }),
    prisma.movement.aggregate({ _sum: { costValue: true }, _avg: { costValue: true }, where: baseWhere(range.start, range.end) }),
    prisma.movement.count({ where: { ...baseWhere(range.start, range.end), voluntary: true } }),
    prisma.movement.count({ where: { ...baseWhere(range.start, range.end), voluntary: false } }),
  ]);

  const months = lastNMonthsKeys(12);
  const series = await Promise.all(
    months.map(async (key) => {
      const [y, m] = key.split("-").map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0, 23, 59, 59);
      return prisma.movement.count({ where: baseWhere(start, end) });
    })
  );

  return {
    current,
    previous,
    delta: percentDelta(current, previous),
    series,
    totalCost: costAgg._sum.costValue ?? 0,
    avgCost: costAgg._avg.costValue ?? 0,
    voluntaryCount,
    involuntaryCount,
  };
}

export async function getDesligamentosByManager(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  const managers = await prisma.manager.findMany({
    select: {
      name: true,
      employees: {
        where: filters.unitId ? { unitId: filters.unitId } : {},
        select: {
          movements: {
            where: { type: MovementType.DESLIGAMENTO, date: { gte: range.start, lte: range.end } },
            select: { id: true },
          },
        },
      },
    },
  });
  return managers
    .map((m) => ({ name: m.name, value: m.employees.reduce((acc, e) => acc + e.movements.length, 0) }))
    .filter((m) => m.value > 0)
    .sort((a, b) => b.value - a.value);
}

export async function getDesligamentosTable(filters: ExecutiveFilters) {
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
