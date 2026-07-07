import { prisma } from "@/lib/prisma";
import { resolvePeriod } from "@/services/period";
import { pairTurnstileGaps } from "@/lib/analytics/turnstile";
import type { ExecutiveFilters } from "@/services/dashboard-executivo";

interface EmployeeMinutes {
  employeeId: string;
  name: string;
  unit: string;
  minutesOut: number;
  occurrences: number;
}

async function computeTimeOutside(filters: ExecutiveFilters): Promise<EmployeeMinutes[]> {
  const range = resolvePeriod(filters.period);

  const events = await prisma.turnstileEvent.findMany({
    where: {
      timestamp: { gte: range.start, lte: range.end },
      ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}),
    },
    include: { employee: { select: { id: true, name: true, unit: { select: { name: true } } } } },
    orderBy: { timestamp: "asc" },
  });

  const employeeInfo = new Map<string, { name: string; unit: string }>();
  for (const ev of events) {
    if (!employeeInfo.has(ev.employeeId)) {
      employeeInfo.set(ev.employeeId, { name: ev.employee.name, unit: ev.employee.unit.name });
    }
  }

  const totals = pairTurnstileGaps(events);

  const results: EmployeeMinutes[] = [];
  for (const [employeeId, { minutesOut, occurrences }] of totals) {
    const info = employeeInfo.get(employeeId);
    if (!info) continue;
    results.push({
      employeeId,
      name: info.name,
      unit: info.unit,
      minutesOut: Math.round(minutesOut),
      occurrences,
    });
  }

  return results.sort((a, b) => b.minutesOut - a.minutesOut);
}

export async function getCatracaKpis(filters: ExecutiveFilters) {
  const data = await computeTimeOutside(filters);
  const totalMinutes = data.reduce((acc, d) => acc + d.minutesOut, 0);
  const totalOccurrences = data.reduce((acc, d) => acc + d.occurrences, 0);
  const avgMinutesPerEmployee = data.length > 0 ? totalMinutes / data.length : 0;

  return {
    totalMinutes,
    totalHours: totalMinutes / 60,
    totalOccurrences,
    avgMinutesPerEmployee,
    criticalEmployees: data.filter((d) => d.minutesOut > 120).length,
  };
}

export async function getCatracaRanking(filters: ExecutiveFilters) {
  const data = await computeTimeOutside(filters);
  return data.slice(0, 15).map((d) => ({ name: d.name, value: d.minutesOut }));
}

export async function getCatracaByUnit(filters: ExecutiveFilters) {
  const data = await computeTimeOutside(filters);
  const map = new Map<string, number>();
  for (const d of data) map.set(d.unit, (map.get(d.unit) ?? 0) + d.minutesOut);
  return Array.from(map.entries()).map(([name, value]) => ({ name, value: Math.round(value) }));
}

export async function getCatracaTable(filters: ExecutiveFilters) {
  const data = await computeTimeOutside(filters);
  return data.slice(0, 50);
}
