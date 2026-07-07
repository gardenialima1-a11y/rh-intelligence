import { prisma } from "@/lib/prisma";
import { resolvePeriod, previousPeriod, percentDelta, lastNMonthsKeys } from "@/services/period";
import type { ExecutiveFilters } from "@/services/dashboard-executivo";

export async function getJornadaKpis(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  const prev = previousPeriod(range);

  async function stats(start: Date, end: Date) {
    const agg = await prisma.timeEntry.aggregate({
      _sum: { overtimeHours: true, scheduledHours: true, bankHoursDelta: true },
      where: {
        date: { gte: start, lte: end },
        ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}),
      },
    });
    return {
      overtime: agg._sum.overtimeHours ?? 0,
      scheduled: agg._sum.scheduledHours ?? 0,
      bankDelta: agg._sum.bankHoursDelta ?? 0,
    };
  }

  const [current, previous] = await Promise.all([stats(range.start, range.end), stats(prev.start, prev.end)]);

  const months = lastNMonthsKeys(12);
  const series = await Promise.all(
    months.map(async (key) => {
      const [y, m] = key.split("-").map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0, 23, 59, 59);
      const s = await stats(start, end);
      return s.overtime;
    })
  );

  const overtimeCost = current.overtime * 22; // custo/hora médio ilustrativo (R$)

  return {
    overtimeHours: current.overtime,
    overtimeCost,
    bankBalance: current.bankDelta,
    excessRate: current.scheduled > 0 ? current.overtime / current.scheduled : 0,
    delta: percentDelta(current.overtime, previous.overtime),
    series,
  };
}

export async function getOvertimeByCostCenter(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);

  const employees = await prisma.employee.findMany({
    where: filters.unitId ? { unitId: filters.unitId } : {},
    select: { id: true, costCenter: { select: { name: true } } },
  });
  const costCenterByEmployee = new Map(employees.map((e) => [e.id, e.costCenter?.name ?? "Sem centro de custo"]));

  const grouped = await prisma.timeEntry.groupBy({
    by: ["employeeId"],
    _sum: { overtimeHours: true },
    where: {
      date: { gte: range.start, lte: range.end },
      employeeId: { in: employees.map((e) => e.id) },
    },
  });

  const totals = new Map<string, number>();
  for (const row of grouped) {
    const ccName = costCenterByEmployee.get(row.employeeId);
    if (!ccName) continue;
    totals.set(ccName, (totals.get(ccName) ?? 0) + (row._sum.overtimeHours ?? 0));
  }

  return Array.from(totals.entries())
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);
}

export async function getOvertimeRanking(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);

  const employees = await prisma.employee.findMany({
    where: { isActive: true, ...(filters.unitId ? { unitId: filters.unitId } : {}) },
    select: { id: true, name: true },
  });
  const nameByEmployee = new Map(employees.map((e) => [e.id, e.name]));

  const grouped = await prisma.timeEntry.groupBy({
    by: ["employeeId"],
    _sum: { overtimeHours: true },
    where: {
      date: { gte: range.start, lte: range.end },
      employeeId: { in: employees.map((e) => e.id) },
    },
    orderBy: { _sum: { overtimeHours: "desc" } },
    take: 15,
  });

  return grouped
    .map((row) => ({ name: nameByEmployee.get(row.employeeId) ?? "—", value: Math.round(row._sum.overtimeHours ?? 0) }))
    .filter((e) => e.value > 0);
}

export async function getJornadaTable(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  return prisma.timeEntry.findMany({
    where: {
      date: { gte: range.start, lte: range.end },
      overtimeHours: { gt: 0 },
      ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}),
    },
    include: { employee: { include: { position: true, unit: true } } },
    orderBy: { date: "desc" },
    take: 50,
  });
}
