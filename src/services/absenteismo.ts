import { prisma } from "@/lib/prisma";
import { resolvePeriod, previousPeriod, percentDelta, monthKeysForPeriod, monthLabelsPtBR } from "@/services/period";
import { calculateBradfordFactor, type BradfordRiskLevel } from "@/lib/analytics/bradford";
import type { ExecutiveFilters } from "@/services/dashboard-executivo";

// Jornada mensal padrão usada para transformar salário em valor-hora (CLT: 220h/mês).
const MONTHLY_HOURS_CLT = 220;

/**
 * Custo estimado das horas perdidas, calculado a partir da faixa salarial do
 * CARGO de cada colaborador (média entre piso e teto), convertida em valor-hora
 * pela jornada mensal padrão (220h). Antes esse cálculo usava um valor fixo de
 * R$ 22/hora para todo mundo (estagiário ou gerente, tanto fazia) — o que inflava
 * ou distorcia o número dependendo de quem faltava. Quando o colaborador não tem
 * cargo com faixa salarial cadastrada, usamos a média salarial dos cargos que
 * têm faixa cadastrada, como aproximação — e reportamos quanto do valor final
 * veio de aproximação (coveragePercent), pra você saber o quanto confiar no número.
 */
async function estimateAbsenceCost(start: Date, end: Date, unitId?: string) {
  const absences = await prisma.absence.findMany({
    where: { date: { gte: start, lte: end }, ...(unitId ? { employee: { unitId } } : {}) },
    select: {
      hoursLost: true,
      employee: { select: { position: { select: { salaryFloor: true, salaryCeil: true } } } },
    },
  });

  if (absences.length === 0) return { cost: 0, coveragePercent: 1 };

  const positionsWithSalary = await prisma.position.findMany({
    where: { salaryFloor: { not: null } },
    select: { salaryFloor: true, salaryCeil: true },
  });
  const fallbackMonthlySalary =
    positionsWithSalary.length > 0
      ? positionsWithSalary.reduce((sum: number, p: { salaryFloor: number | null; salaryCeil: number | null }) => sum + ((p.salaryFloor ?? 0) + (p.salaryCeil ?? p.salaryFloor ?? 0)) / 2, 0) /
        positionsWithSalary.length
      : 0;
  const fallbackHourlyRate = fallbackMonthlySalary / MONTHLY_HOURS_CLT;

  let cost = 0;
  let totalHours = 0;
  let coveredHours = 0;
  for (const a of absences) {
    totalHours += a.hoursLost;
    const pos = a.employee.position;
    let hourlyRate = fallbackHourlyRate;
    if (pos?.salaryFloor) {
      const monthlySalary = (pos.salaryFloor + (pos.salaryCeil ?? pos.salaryFloor)) / 2;
      hourlyRate = monthlySalary / MONTHLY_HOURS_CLT;
      coveredHours += a.hoursLost;
    }
    cost += a.hoursLost * hourlyRate;
  }

  return { cost, coveragePercent: totalHours > 0 ? coveredHours / totalHours : 0 };
}

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
    const scheduled = scheduledAgg._sum.scheduledHours ?? 0;
    // Sem jornada esperada registrada nesse período, não dá pra calcular uma taxa de
    // verdade — melhor mostrar 0 do que uma taxa absurda (dividir "horas perdidas" por
    // um valor de segurança de 1 hora inflava a taxa pra milhares de %).
    const rate = scheduled > 0 ? lost / scheduled : 0;
    return { lost, scheduled, rate, occurrences };
  }

  const [current, previous, costEstimate] = await Promise.all([
    stats(range.start, range.end),
    stats(prev.start, prev.end),
    estimateAbsenceCost(range.start, range.end, filters.unitId),
  ]);

  const months = monthKeysForPeriod(filters.period);
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
    estimatedCost: costEstimate.cost,
    estimatedCostCoverage: costEstimate.coveragePercent,
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

export interface AbsenteeismoMonthBreakdown {
  key: string;
  label: string;
  rate: number;
  hoursLost: number;
  occurrences: number;
  /** true quando a taxa do mês está pelo menos 20% acima da média do período analisado. */
  isAlta: boolean;
  percentComAtestado: number;
  percentSemAtestado: number;
  motivoPrincipal: { label: string; hoursLost: number } | null;
  setorSecundarioMaisImpactado: { name: string; hoursLost: number } | null;
  /** Texto pronto, em tom analítico (não alarmista), pra usar direto no hover ou na análise estratégica. */
  insight: string;
}

function buildInsight(m: Omit<AbsenteeismoMonthBreakdown, "insight">): string {
  if (m.occurrences === 0) return "Sem ausências registradas neste mês.";

  const parts: string[] = [];
  const semPct = Math.round(m.percentSemAtestado * 100);
  const comPct = Math.round(m.percentComAtestado * 100);

  if (m.percentSemAtestado > m.percentComAtestado) {
    parts.push(`a maior parte das ausências (${semPct}%) não teve atestado registrado`);
  } else if (comPct > 0) {
    parts.push(`a maior parte das ausências (${comPct}%) teve atestado médico`);
  }

  if (m.setorSecundarioMaisImpactado) {
    parts.push(`o setor secundário mais impactado foi ${m.setorSecundarioMaisImpactado.name}`);
  }

  if (m.motivoPrincipal) {
    parts.push(`o motivo mais frequente foi "${m.motivoPrincipal.label}"`);
  }

  if (parts.length === 0) return "Sem detalhamento suficiente para este mês.";
  return parts[0].charAt(0).toUpperCase() + parts[0].slice(1) + (parts.length > 1 ? "; " + parts.slice(1).join("; ") : "") + ".";
}

/**
 * Análise mês a mês: pra cada mês do período, calcula o mix atestado x falta não
 * justificada, o setor secundário mais impactado e o motivo mais frequente, e
 * sinaliza (isAlta) os meses em que a taxa de absenteísmo ficou pelo menos 20%
 * acima da média do próprio período — usado no hover do gráfico e no botão de
 * "Análise estratégica". O corte é relativo à média do período (e não um valor
 * fixo tipo "5% é crítico") de propósito: evita marcar tudo como grave quando o
 * período inteiro já está ruim, e evita marcar tudo como ok quando está tudo baixo.
 */
export async function getAbsenteismoMonthlyBreakdown(filters: ExecutiveFilters): Promise<AbsenteeismoMonthBreakdown[]> {
  const months = monthKeysForPeriod(filters.period);
  const labels = monthLabelsPtBR(months);

  const raw = await Promise.all(
    months.map(async (key) => {
      const [y, m] = key.split("-").map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0, 23, 59, 59);

      const [lostAgg, scheduledAgg, absences] = await Promise.all([
        prisma.absence.aggregate({
          _sum: { hoursLost: true },
          where: { date: { gte: start, lte: end }, ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}) },
        }),
        prisma.timeEntry.aggregate({
          _sum: { scheduledHours: true },
          where: { date: { gte: start, lte: end }, ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}) },
        }),
        prisma.absence.findMany({
          where: { date: { gte: start, lte: end }, ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}) },
          select: {
            hoursLost: true,
            hasCertificate: true,
            reason: { select: { label: true } },
            employee: { select: { secondaryCostCenter: { select: { name: true } } } },
          },
        }),
      ]);

      const lost = lostAgg._sum.hoursLost ?? 0;
      const scheduled = scheduledAgg._sum.scheduledHours ?? 0;
      const rate = scheduled > 0 ? lost / scheduled : 0;

      let comAtestadoHoras = 0;
      let semAtestadoHoras = 0;
      const motivoMap = new Map<string, number>();
      const setorSecMap = new Map<string, number>();

      for (const a of absences) {
        if (a.hasCertificate) comAtestadoHoras += a.hoursLost;
        else semAtestadoHoras += a.hoursLost;

        const motivoLabel = a.reason?.label ?? "Não informado";
        motivoMap.set(motivoLabel, (motivoMap.get(motivoLabel) ?? 0) + a.hoursLost);

        const setorSec = a.employee.secondaryCostCenter?.name;
        if (setorSec) setorSecMap.set(setorSec, (setorSecMap.get(setorSec) ?? 0) + a.hoursLost);
      }

      const totalHoras = comAtestadoHoras + semAtestadoHoras;
      const motivoPrincipal = [...motivoMap.entries()].sort((a, b) => b[1] - a[1])[0];
      const setorSecundarioTop = [...setorSecMap.entries()].sort((a, b) => b[1] - a[1])[0];

      return {
        key,
        rate,
        hoursLost: lost,
        occurrences: absences.length,
        percentComAtestado: totalHoras > 0 ? comAtestadoHoras / totalHoras : 0,
        percentSemAtestado: totalHoras > 0 ? semAtestadoHoras / totalHoras : 0,
        motivoPrincipal: motivoPrincipal ? { label: motivoPrincipal[0], hoursLost: Math.round(motivoPrincipal[1]) } : null,
        setorSecundarioMaisImpactado: setorSecundarioTop
          ? { name: setorSecundarioTop[0], hoursLost: Math.round(setorSecundarioTop[1]) }
          : null,
      };
    })
  );

  const ratesWithData = raw.map((r) => r.rate).filter((r) => r > 0);
  const avgRate = ratesWithData.length > 0 ? ratesWithData.reduce((s, r) => s + r, 0) / ratesWithData.length : 0;
  const highThreshold = avgRate * 1.2;

  return raw.map((r, i) => {
    const base = {
      ...r,
      label: labels[i],
      isAlta: r.rate > 0 && r.rate >= highThreshold,
    };
    return { ...base, insight: buildInsight(base) };
  });
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

export interface FaltaRow {
  date: Date;
  employeeName: string;
  registration: string;
  setorPrincipal: string | null;
  setorSecundario: string | null;
  temAtestado: boolean;
  atrasoMinutos: number | null;
}

/**
 * Faltas detectadas automaticamente pela importação do relatório de ponto,
 * já cruzadas com os atestados médicos cadastrados (SST → Atestados) pela
 * mesma data. Sempre exclui quem está marcado como Cargo de Confiança.
 */
export async function getFaltasComCruzamento(limit = 200) {
  const faltas = await prisma.attendanceRecord.findMany({
    where: { status: "FALTOU" },
    orderBy: { date: "desc" },
    take: limit,
    include: {
      employee: {
        select: {
          name: true,
          registration: true,
          costCenter: { select: { name: true } },
          secondaryCostCenter: { select: { name: true } },
        },
      },
    },
  });

  if (faltas.length === 0) return [];

  const employeeIds = Array.from(new Set(faltas.map((f) => f.employeeId)));
  const dates = faltas.map((f) => f.date);
  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

  const absences = await prisma.absence.findMany({
    where: { employeeId: { in: employeeIds }, date: { gte: minDate, lte: maxDate }, hasCertificate: true },
    select: { employeeId: true, date: true },
  });
  const certificateKeys = new Set(absences.map((a) => `${a.employeeId}_${a.date.toISOString().slice(0, 10)}`));

  const rows: FaltaRow[] = faltas.map((f) => ({
    date: f.date,
    employeeName: f.employee.name,
    registration: f.employee.registration,
    setorPrincipal: f.employee.costCenter?.name ?? null,
    setorSecundario: f.employee.secondaryCostCenter?.name ?? null,
    temAtestado: certificateKeys.has(`${f.employeeId}_${f.date.toISOString().slice(0, 10)}`),
    atrasoMinutos: f.atrasoMinutos,
  }));

  return rows;
}

export interface FaltasBySetorRow {
  setor: string;
  faltas: number;
  comAtestado: number;
  semAtestado: number;
}

export async function getFaltasPorSetorPrincipal(): Promise<FaltasBySetorRow[]> {
  const rows = await getFaltasComCruzamento(1000);
  const map = new Map<string, FaltasBySetorRow>();
  for (const r of rows) {
    const setor = r.setorPrincipal ?? "Não informado";
    const cur = map.get(setor) ?? { setor, faltas: 0, comAtestado: 0, semAtestado: 0 };
    cur.faltas += 1;
    if (r.temAtestado) cur.comAtestado += 1;
    else cur.semAtestado += 1;
    map.set(setor, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.faltas - a.faltas);
}

export async function getFaltasPorSetorSecundario(): Promise<FaltasBySetorRow[]> {
  const rows = await getFaltasComCruzamento(1000);
  const map = new Map<string, FaltasBySetorRow>();
  for (const r of rows) {
    if (!r.setorSecundario) continue;
    const setor = r.setorSecundario;
    const cur = map.get(setor) ?? { setor, faltas: 0, comAtestado: 0, semAtestado: 0 };
    cur.faltas += 1;
    if (r.temAtestado) cur.comAtestado += 1;
    else cur.semAtestado += 1;
    map.set(setor, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.faltas - a.faltas);
}
