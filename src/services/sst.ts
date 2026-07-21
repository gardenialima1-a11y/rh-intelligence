import { prisma } from "@/lib/prisma";
import { resolvePeriod, lastNMonthsKeys } from "@/services/period";
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

/**
 * Analytics real de absenteísmo (SST): maiores ausentes, motivos e
 * sazonalidade. Tudo calculado ao vivo a partir da tabela Absence — conforme
 * novos atestados/ausências são cadastrados, esses três gráficos mudam
 * automaticamente, sem qualquer valor fixo.
 */
export async function getAbsenteeismInsights(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  const where = {
    date: { gte: range.start, lte: range.end },
    ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}),
  };

  const absences = await prisma.absence.findMany({
    where,
    select: {
      date: true,
      hoursLost: true,
      employee: { select: { name: true } },
      reason: { select: { label: true } },
    },
  });

  // Maiores ausentes: ranking por horas perdidas (empate resolvido por nº de ocorrências).
  const byEmployee = new Map<string, { name: string; occurrences: number; hoursLost: number }>();
  for (const a of absences) {
    const name = a.employee?.name ?? "Sem colaborador";
    const cur = byEmployee.get(name) ?? { name, occurrences: 0, hoursLost: 0 };
    cur.occurrences += 1;
    cur.hoursLost += a.hoursLost;
    byEmployee.set(name, cur);
  }
  const topAbsentees = Array.from(byEmployee.values())
    .sort((a, b) => b.hoursLost - a.hoursLost)
    .slice(0, 10)
    .map((e) => ({ name: e.name, value: Number(e.hoursLost.toFixed(1)), occurrences: e.occurrences }));

  // Motivos: soma de horas perdidas por motivo cadastrado (Reason).
  const byReason = new Map<string, number>();
  for (const a of absences) {
    const label = a.reason?.label ?? "Sem motivo informado";
    byReason.set(label, (byReason.get(label) ?? 0) + a.hoursLost);
  }
  const reasons = Array.from(byReason.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value: Number(value.toFixed(1)) }));

  // Sazonalidade: últimos 12 meses, horas perdidas e nº de ausências por mês.
  const months = lastNMonthsKeys(12);
  const seasonalityAbsences = await prisma.absence.findMany({
    where: {
      date: { gte: new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1) },
      ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}),
    },
    select: { date: true, hoursLost: true },
  });
  const seasonalityMap = new Map<string, { hoursLost: number; occurrences: number }>();
  for (const key of months) seasonalityMap.set(key, { hoursLost: 0, occurrences: 0 });
  for (const a of seasonalityAbsences) {
    const key = `${a.date.getFullYear()}-${String(a.date.getMonth() + 1).padStart(2, "0")}`;
    const cur = seasonalityMap.get(key);
    if (cur) {
      cur.hoursLost += a.hoursLost;
      cur.occurrences += 1;
    }
  }
  const seasonality = months.map((key) => ({
    month: key,
    hoursLost: Number((seasonalityMap.get(key)?.hoursLost ?? 0).toFixed(1)),
    occurrences: seasonalityMap.get(key)?.occurrences ?? 0,
  }));

  return { topAbsentees, reasons, seasonality, totalOccurrences: absences.length };
}
