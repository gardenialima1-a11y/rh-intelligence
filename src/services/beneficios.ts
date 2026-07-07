import { prisma } from "@/lib/prisma";
import { resolvePeriod, lastNMonthsKeys } from "@/services/period";
import type { ExecutiveFilters } from "@/services/dashboard-executivo";

export async function getBeneficiosKpis(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);

  const agg = await prisma.payrollEntry.aggregate({
    _sum: { benefitsCost: true },
    _avg: { benefitsCost: true },
    where: { competence: { gte: range.start, lte: range.end }, ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}) },
  });

  const headcount = await prisma.employee.count({
    where: { isActive: true, ...(filters.unitId ? { unitId: filters.unitId } : {}) },
  });

  return {
    totalCost: agg._sum.benefitsCost ?? 0,
    avgCostPerEmployee: agg._avg.benefitsCost ?? 0,
    headcount,
  };
}

export async function getBenefitsCostTrend(filters: ExecutiveFilters) {
  const months = lastNMonthsKeys(12);
  return Promise.all(
    months.map(async (key) => {
      const [y, m] = key.split("-").map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0, 23, 59, 59);
      const agg = await prisma.payrollEntry.aggregate({
        _sum: { benefitsCost: true },
        where: { competence: { gte: start, lte: end }, ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}) },
      });
      return agg._sum.benefitsCost ?? 0;
    })
  );
}

export async function getBenefitsCostByCostCenter(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);

  const employees = await prisma.employee.findMany({
    where: filters.unitId ? { unitId: filters.unitId } : {},
    select: { id: true, costCenter: { select: { name: true } } },
  });
  const costCenterByEmployee = new Map(employees.map((e) => [e.id, e.costCenter?.name ?? "Sem centro de custo"]));

  const grouped = await prisma.payrollEntry.groupBy({
    by: ["employeeId"],
    _sum: { benefitsCost: true },
    where: {
      competence: { gte: range.start, lte: range.end },
      employeeId: { in: employees.map((e) => e.id) },
    },
  });

  const totals = new Map<string, number>();
  for (const row of grouped) {
    const ccName = costCenterByEmployee.get(row.employeeId);
    if (!ccName) continue;
    totals.set(ccName, (totals.get(ccName) ?? 0) + (row._sum.benefitsCost ?? 0));
  }

  return Array.from(totals.entries())
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);
}
