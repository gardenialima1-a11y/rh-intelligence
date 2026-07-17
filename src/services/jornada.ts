import { prisma } from "@/lib/prisma";
import { resolvePeriod, previousPeriod, percentDelta, lastNMonthsKeys } from "@/services/period";
import type { ExecutiveFilters } from "@/services/dashboard-executivo";

/**
 * Monta o filtro de colaborador (Employee) a partir de unidade, setor
 * principal e setor secundário. Reaproveitado em todas as consultas do
 * módulo de Jornada para que os três filtros funcionem juntos.
 */
function employeeFilter(filters: ExecutiveFilters) {
  return {
    ...(filters.unitId ? { unitId: filters.unitId } : {}),
    ...(filters.costCenterId ? { costCenterId: filters.costCenterId } : {}),
    ...(filters.secondaryCostCenterId ? { secondaryCostCenterId: filters.secondaryCostCenterId } : {}),
  };
}

function hasEmployeeFilter(filters: ExecutiveFilters) {
  return Boolean(filters.unitId || filters.costCenterId || filters.secondaryCostCenterId);
}

export async function getJornadaKpis(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  const prev = previousPeriod(range);

  async function stats(start: Date, end: Date) {
    const agg = await prisma.timeEntry.aggregate({
      _sum: { overtimeHours: true, scheduledHours: true, bankHoursDelta: true, overtimeCost: true },
      where: {
        date: { gte: start, lte: end },
        ...(hasEmployeeFilter(filters) ? { employee: employeeFilter(filters) } : {}),
      },
    });
    return {
      overtime: agg._sum.overtimeHours ?? 0,
      scheduled: agg._sum.scheduledHours ?? 0,
      bankDelta: agg._sum.bankHoursDelta ?? 0,
      overtimeCost: agg._sum.overtimeCost ?? 0,
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

  const overtimeCost = current.overtimeCost;

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
    where: employeeFilter(filters),
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
    where: { isActive: true, ...employeeFilter(filters) },
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
      ...(hasEmployeeFilter(filters) ? { employee: employeeFilter(filters) } : {}),
    },
    include: { employee: { include: { position: true, unit: true } } },
    orderBy: { date: "desc" },
    take: 50,
  });
}

export interface OvertimeBySectorRow {
  name: string;
  hours: number;
  cost: number;
}

export async function getOvertimeBySecondaryCostCenter(filters: ExecutiveFilters): Promise<OvertimeBySectorRow[]> {
  const range = resolvePeriod(filters.period);

  const employees = await prisma.employee.findMany({
    where: employeeFilter(filters),
    select: { id: true, secondaryCostCenter: { select: { name: true } } },
  });
  const sectorByEmployee = new Map(employees.map((e) => [e.id, e.secondaryCostCenter?.name ?? null]));

  const grouped = await prisma.timeEntry.groupBy({
    by: ["employeeId"],
    _sum: { overtimeHours: true, overtimeCost: true },
    where: {
      date: { gte: range.start, lte: range.end },
      employeeId: { in: employees.map((e) => e.id) },
    },
  });

  const totals = new Map<string, { hours: number; cost: number }>();
  for (const row of grouped) {
    const sector = sectorByEmployee.get(row.employeeId);
    if (!sector) continue;
    const cur = totals.get(sector) ?? { hours: 0, cost: 0 };
    cur.hours += row._sum.overtimeHours ?? 0;
    cur.cost += row._sum.overtimeCost ?? 0;
    totals.set(sector, cur);
  }

  return Array.from(totals.entries())
    .map(([name, v]) => ({ name, hours: Math.round(v.hours * 10) / 10, cost: Math.round(v.cost * 100) / 100 }))
    .filter((r) => r.hours > 0)
    .sort((a, b) => b.cost - a.cost);
}
