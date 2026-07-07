import { prisma } from "@/lib/prisma";
import { resolvePeriod, previousPeriod, percentDelta, lastNMonthsKeys } from "@/services/period";
import { calculateBradfordFactor, type BradfordRiskLevel } from "@/lib/analytics/bradford";
import type { ExecutiveFilters } from "@/services/dashboard-executivo";

export async function getAbsenteismoKpis(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  const prev = previousPeriod(range);

  async function stats(start: Date, end: Date) {
    const [lostAgg, scheduledAgg, occurrences] = await Promise.all([
      prisma.absence.aggregate({
        _sum: { hoursLost: true },
        where: { date: { gte: start, lte: end }, ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}) },
      }),
      prisma.timeEntry.aggregate({
        _sum: { scheduledHours: true },
        where: { date: { gte: start, lte: end }, ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}) },
      }),
      prisma.absence.count({
        where: { date: { gte: start, lte: end }, ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}) },
      }),
    ]);
    const lost = lostAgg._sum.hoursLost ?? 0;
    const scheduled = scheduledAgg._sum.scheduledHours ?? 1;
    return { lost, scheduled, rate: lost / scheduled, occurrences };
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

  return {
    hoursLost: current.lost,
    occurrences: current.occurrences,
    rate: current.rate,
    delta: percentDelta(current.rate, previous.rate),
    series,
    estimatedCost: current.lost * 22,
  };
}

export interface BradfordFactorRow {
  employeeId: string;
  name: string;
  unit: string;
  occurrences: number;
  totalDays: number;
  bradfordScore: number;
  riskLevel: BradfordRiskLevel;
}

/**
 * Bradford Factor (B = S² × D) — métrica clássica de gestão de absenteísmo
 * (Bradford University / CIPD), amplamente usada por consultorias de RH.
 * Penaliza mais fortemente padrões de faltas curtas e frequentes do que
 * um único afastamento longo, pois o primeiro tende a indicar maior
 * impacto disciplinar/organizacional. Faixas de referência de mercado:
 * < 50 normal · 50-449 atenção · ≥ 450 crítico (padrão de RH consultivo).
 */
export async function getBradfordFactorRanking(filters: ExecutiveFilters): Promise<BradfordFactorRow[]> {
  const range = resolvePeriod(filters.period);

  const absences = await prisma.absence.findMany({
    where: { date: { gte: range.start, lte: range.end }, ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}) },
    select: { employeeId: true, hoursLost: true, employee: { select: { name: true, unit: { select: { name: true } } } } },
  });

  const byEmployee = new Map<string, { name: string; unit: string; occurrences: number; totalHours: number }>();
  for (const a of absences) {
    const cur = byEmployee.get(a.employeeId) ?? { name: a.employee.name, unit: a.employee.unit.name, occurrences: 0, totalHours: 0 };
    cur.occurrences += 1;
    cur.totalHours += a.hoursLost;
    byEmployee.set(a.employeeId, cur);
  }

  const rows: BradfordFactorRow[] = Array.from(byEmployee.entries()).map(([employeeId, v]) => {
    const { totalDays, bradfordScore, riskLevel } = calculateBradfordFactor(v.occurrences, v.totalHours);
    return { employeeId, name: v.name, unit: v.unit, occurrences: v.occurrences, totalDays, bradfordScore, riskLevel };
  });

  return rows.sort((a, b) => b.bradfordScore - a.bradfordScore);
}

export async function getAbsenceByReason(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  const absences = await prisma.absence.findMany({
    where: { date: { gte: range.start, lte: range.end }, ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}) },
    include: { reason: true },
  });
  const map = new Map<string, number>();
  for (const a of absences) {
    const label = a.reason?.label ?? "Não informado";
    map.set(label, (map.get(label) ?? 0) + a.hoursLost);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .sort((a, b) => b.value - a.value);
}

export async function getAbsenceByCostCenter(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);

  const employees = await prisma.employee.findMany({
    where: filters.unitId ? { unitId: filters.unitId } : {},
    select: { id: true, costCenter: { select: { name: true } } },
  });
  const costCenterByEmployee = new Map(employees.map((e) => [e.id, e.costCenter?.name ?? "Sem centro de custo"]));

  const grouped = await prisma.absence.groupBy({
    by: ["employeeId"],
    _sum: { hoursLost: true },
    where: {
      date: { gte: range.start, lte: range.end },
      employeeId: { in: employees.map((e) => e.id) },
    },
  });

  const totals = new Map<string, number>();
  for (const row of grouped) {
    const ccName = costCenterByEmployee.get(row.employeeId);
    if (!ccName) continue;
    totals.set(ccName, (totals.get(ccName) ?? 0) + (row._sum.hoursLost ?? 0));
  }

  return Array.from(totals.entries())
    .map(([name, value]) => ({ name, value: Math.round(value) }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value);
}

export async function getAbsenceTable(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  return prisma.absence.findMany({
    where: { date: { gte: range.start, lte: range.end }, ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}) },
    include: { employee: { include: { position: true, unit: true } }, reason: true },
    orderBy: { date: "desc" },
    take: 50,
  });
}
