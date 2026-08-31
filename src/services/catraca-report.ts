import { prisma } from "@/lib/prisma";
import { resolvePeriod } from "@/services/period";
import { pairTurnstileGaps, pairTurnstileGapsDetailed } from "@/lib/analytics/turnstile";
import { buildCatracaAttentionPoints, type AttentionPoint } from "@/lib/analytics/catraca-insight";
import { getCatracaHistorico } from "@/services/catraca-historico";
import type { ExecutiveFilters } from "@/services/dashboard-executivo";

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export interface CatracaReportKpis {
  totalMinutes: number;
  totalHours: number;
  totalOccurrences: number;
  avgMinutesPerEmployee: number;
  criticalEmployees: number;
  monitoredEmployees: number;
}

export interface CatracaReportHourBucket {
  hour: number;
  occurrences: number;
  minutes: number;
}

export interface CatracaReportAreaRow {
  name: string;
  hours: number;
  minutes: number;
  occurrences: number;
  employees: number;
}

export interface CatracaReportMonthRow {
  key: string;
  label: string;
  occurrences: number;
  minutes: number;
  daysWithData: number;
  occurrencesPerDay: number;
}

export interface CatracaReportEmployeeRow {
  employeeId: string;
  name: string;
  unit: string;
  area: string | null;
  sector: string | null;
  minutesOut: number;
  occurrences: number;
}

export interface CatracaReportData {
  periodStart: Date;
  periodEnd: Date;
  kpis: CatracaReportKpis;
  attentionPoints: AttentionPoint[];
  hourly: CatracaReportHourBucket[];
  peakHour: { hour: number; occurrences: number; pct: number } | null;
  byArea: CatracaReportAreaRow[];
  monthlyTrend: CatracaReportMonthRow[];
  criticalRanking: CatracaReportEmployeeRow[];
  ranking: CatracaReportEmployeeRow[];
}

/**
 * Monta todos os dados do relatório gerencial da Catraca (KPIs, horário de
 * pico, distribuição por setor, evolução mensal e ranking de colaboradores
 * críticos) a partir de uma única leitura dos eventos de catraca no período
 * — usado pela exportação em PDF (src/app/api/reports/catraca).
 *
 * Reaproveita as mesmas regras de negócio já validadas em
 * src/lib/analytics/turnstile.ts (pairTurnstileGaps / pairTurnstileGapsDetailed)
 * e o mesmo texto de pontos de atenção do dashboard (buildCatracaAttentionPoints).
 */
export async function getCatracaReportData(filters: ExecutiveFilters): Promise<CatracaReportData> {
  const range = resolvePeriod(filters.period);

  const events = await prisma.turnstileEvent.findMany({
    where: {
      timestamp: { gte: range.start, lte: range.end },
      ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}),
    },
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          unit: { select: { name: true } },
          costCenter: { select: { area: true, name: true } },
          secondaryCostCenter: { select: { name: true } },
        },
      },
    },
    orderBy: { timestamp: "asc" },
  });

  const employeeInfo = new Map<
    string,
    { name: string; unit: string; area: string | null; sector: string | null; secondarySector: string | null }
  >();
  for (const ev of events) {
    if (!employeeInfo.has(ev.employeeId)) {
      employeeInfo.set(ev.employeeId, {
        name: ev.employee.name,
        unit: ev.employee.unit.name,
        area: ev.employee.costCenter?.area ?? null,
        sector: ev.employee.costCenter?.name ?? null,
        secondarySector: ev.employee.secondaryCostCenter?.name ?? null,
      });
    }
  }

  const eventLikes = events.map((e: (typeof events)[number]) => ({
    employeeId: e.employeeId,
    timestamp: e.timestamp,
    direction: e.direction,
  }));
  const totals = pairTurnstileGaps(eventLikes);
  const detailed = pairTurnstileGapsDetailed(eventLikes);

  // ---- KPIs -----------------------------------------------------------
  let totalMinutes = 0;
  let totalOccurrences = 0;
  let criticalEmployees = 0;
  for (const { minutesOut, occurrences } of totals.values()) {
    totalMinutes += minutesOut;
    totalOccurrences += occurrences;
    if (minutesOut > 120) criticalEmployees += 1;
  }
  const monitoredEmployees = totals.size;
  const avgMinutesPerEmployee = monitoredEmployees > 0 ? totalMinutes / monitoredEmployees : 0;

  // ---- Horário de pico (hora de saída do posto nas ocorrências contadas) --
  const hourMap = new Map<number, { occurrences: number; minutes: number }>();
  for (const d of detailed) {
    const cur = hourMap.get(d.entrada.getHours()) ?? { occurrences: 0, minutes: 0 };
    cur.occurrences += 1;
    cur.minutes += d.minutesOut;
    hourMap.set(d.entrada.getHours(), cur);
  }
  const hourly = Array.from(hourMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([hour, v]) => ({ hour, ...v }));
  const topHour = [...hourly].sort((a, b) => b.occurrences - a.occurrences)[0] ?? null;
  const peakHour = topHour && detailed.length > 0 ? { hour: topHour.hour, occurrences: topHour.occurrences, pct: Math.round((topHour.occurrences / detailed.length) * 100) } : null;

  // ---- Por área/setor (CostCenter.area — Produção, Logística, ...) -----
  const areaMap = new Map<string, { minutes: number; occurrences: number; employees: Set<string> }>();
  for (const [employeeId, { minutesOut, occurrences }] of totals) {
    const info = employeeInfo.get(employeeId);
    const key = info?.area ?? "Sem área definida";
    const cur = areaMap.get(key) ?? { minutes: 0, occurrences: 0, employees: new Set<string>() };
    cur.minutes += minutesOut;
    cur.occurrences += occurrences;
    cur.employees.add(employeeId);
    areaMap.set(key, cur);
  }
  const byArea = Array.from(areaMap.entries())
    .map(([name, v]) => ({
      name,
      hours: Math.round((v.minutes / 60) * 10) / 10,
      minutes: Math.round(v.minutes),
      occurrences: v.occurrences,
      employees: v.employees.size,
    }))
    .sort((a, b) => b.minutes - a.minutes);

  // ---- Evolução mensal (normalizada por dia com leitura de catraca) ----
  const monthMap = new Map<string, { occurrences: number; minutes: number; days: Set<string> }>();
  for (const d of detailed) {
    const key = `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, "0")}`;
    const cur = monthMap.get(key) ?? { occurrences: 0, minutes: 0, days: new Set<string>() };
    cur.occurrences += 1;
    cur.minutes += d.minutesOut;
    cur.days.add(d.date.toISOString().slice(0, 10));
    monthMap.set(key, cur);
  }
  const monthlyTrend = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => {
      const [year, month] = key.split("-").map(Number);
      return {
        key,
        label: `${MONTH_LABELS[month - 1]}/${year}`,
        occurrences: v.occurrences,
        minutes: Math.round(v.minutes),
        daysWithData: v.days.size,
        occurrencesPerDay: v.days.size > 0 ? Math.round((v.occurrences / v.days.size) * 10) / 10 : 0,
      };
    });

  // ---- Ranking de colaboradores ----------------------------------------
  const allRows: CatracaReportEmployeeRow[] = Array.from(totals.entries())
    .map(([employeeId, v]) => {
      const info = employeeInfo.get(employeeId);
      return {
        employeeId,
        name: info?.name ?? "—",
        unit: info?.unit ?? "—",
        area: info?.area ?? null,
        sector: info?.secondarySector ?? info?.sector ?? null,
        minutesOut: Math.round(v.minutesOut),
        occurrences: v.occurrences,
      };
    })
    .sort((a, b) => b.minutesOut - a.minutesOut);

  const criticalRanking = allRows.filter((r) => r.minutesOut > 120);

  // ---- Pontos de atenção (mesmo texto usado no dashboard) --------------
  const byUnitMap = new Map<string, number>();
  for (const [employeeId, { minutesOut }] of totals) {
    const key = employeeInfo.get(employeeId)?.unit ?? "—";
    byUnitMap.set(key, (byUnitMap.get(key) ?? 0) + minutesOut);
  }
  const byUnit = Array.from(byUnitMap.entries()).map(([name, value]) => ({ name, value: Math.round(value) }));

  const historico = await getCatracaHistorico();
  const attentionPoints = buildCatracaAttentionPoints({
    criticalEmployees,
    ranking: allRows.slice(0, 15).map((r) => ({ name: r.name, value: r.minutesOut })),
    byUnit,
    historico,
  });

  return {
    periodStart: range.start,
    periodEnd: range.end,
    kpis: {
      totalMinutes: Math.round(totalMinutes),
      totalHours: Math.round((totalMinutes / 60) * 10) / 10,
      totalOccurrences,
      avgMinutesPerEmployee: Math.round(avgMinutesPerEmployee),
      criticalEmployees,
      monitoredEmployees,
    },
    attentionPoints,
    hourly,
    peakHour,
    byArea,
    monthlyTrend,
    criticalRanking,
    ranking: allRows.slice(0, 15),
  };
}
