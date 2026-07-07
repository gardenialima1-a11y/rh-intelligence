import { prisma } from "@/lib/prisma";
import { resolvePeriod, lastNMonthsKeys } from "@/services/period";
import type { ExecutiveFilters } from "@/services/dashboard-executivo";

export async function getCustosKpis(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);

  const [payrollAgg, revenueAgg, headcount] = await Promise.all([
    prisma.payrollEntry.aggregate({
      _sum: { totalCost: true, baseSalary: true, benefitsCost: true, chargesCost: true },
      where: { competence: { gte: range.start, lte: range.end }, ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}) },
    }),
    prisma.revenueEntry.aggregate({
      _sum: { amount: true },
      where: { competence: { gte: range.start, lte: range.end } },
    }),
    prisma.employee.count({ where: { isActive: true, ...(filters.unitId ? { unitId: filters.unitId } : {}) } }),
  ]);

  const totalCost = payrollAgg._sum.totalCost ?? 0;
  const totalRevenue = revenueAgg._sum.amount ?? 0;

  return {
    totalCost,
    baseSalaryTotal: payrollAgg._sum.baseSalary ?? 0,
    benefitsCost: payrollAgg._sum.benefitsCost ?? 0,
    chargesCost: payrollAgg._sum.chargesCost ?? 0,
    totalRevenue,
    costToRevenueRatio: totalRevenue > 0 ? totalCost / totalRevenue : null,
    costPerHeadcount: headcount > 0 ? totalCost / headcount : 0,
  };
}

export async function getCostTrend(filters: ExecutiveFilters) {
  const months = lastNMonthsKeys(12);
  return Promise.all(
    months.map(async (key) => {
      const [y, m] = key.split("-").map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0, 23, 59, 59);
      const agg = await prisma.payrollEntry.aggregate({
        _sum: { totalCost: true },
        where: { competence: { gte: start, lte: end }, ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}) },
      });
      return agg._sum.totalCost ?? 0;
    })
  );
}

export async function getCostByCostCenter(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);

  const employees = await prisma.employee.findMany({
    where: filters.unitId ? { unitId: filters.unitId } : {},
    select: { id: true, costCenter: { select: { name: true } } },
  });
  const costCenterByEmployee = new Map(employees.map((e) => [e.id, e.costCenter?.name ?? "Sem centro de custo"]));

  const grouped = await prisma.payrollEntry.groupBy({
    by: ["employeeId"],
    _sum: { totalCost: true },
    where: {
      competence: { gte: range.start, lte: range.end },
      employeeId: { in: employees.map((e) => e.id) },
    },
  });

  const totals = new Map<string, number>();
  for (const row of grouped) {
    const ccName = costCenterByEmployee.get(row.employeeId);
    if (!ccName) continue;
    totals.set(ccName, (totals.get(ccName) ?? 0) + (row._sum.totalCost ?? 0));
  }

  return Array.from(totals.entries())
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);
}

export async function getAverageSalaryByPosition(filters: ExecutiveFilters) {
  const positions = await prisma.position.findMany({
    select: {
      name: true,
      employees: {
        where: { isActive: true, ...(filters.unitId ? { unitId: filters.unitId } : {}) },
        select: { payrolls: { orderBy: { competence: "desc" }, take: 1, select: { baseSalary: true } } },
      },
    },
  });
  return positions
    .map((p) => {
      const salaries = p.employees.flatMap((e) => e.payrolls.map((pr) => pr.baseSalary));
      const avg = salaries.length > 0 ? salaries.reduce((a, s) => a + s, 0) / salaries.length : 0;
      return { name: p.name, value: Math.round(avg) };
    })
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value);
}
