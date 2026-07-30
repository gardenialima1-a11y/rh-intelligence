import { prisma } from "@/lib/prisma";
import { resolvePeriod, previousPeriod, percentDelta, monthKeysForPeriod, monthLabelsPtBR, monthKey } from "@/services/period";
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

export interface OcorrenciaDetalhada {
  date: Date;
  employeeName: string;
  registration: string;
  setorPrincipal: string | null;
  setorSecundario: string | null;
  status: string;
  motivoLabel: string;
  /** Se esse dia entra no cálculo da taxa de absenteísmo (mesma regra da importação). */
  entraNoCalculo: boolean;
  hasCertificate: boolean;
  hoursLost: number;
  mesKey: string;
}

const STATUS_LABELS: Record<string, string> = {
  FALTOU: "Falta injustificada",
  FERIAS: "Férias",
  FOLGA: "Folga",
  FERIADO: "Feriado",
  SEM_JORNADA: "Sem jornada",
  DISPENSADO: "Dispensa",
  LICENCA: "Licença",
  ATESTADO: "Atestado médico",
  DECLARACAO: "Declaração",
  ABONO: "Abono autorizado pela gestão",
  CURSO_APRENDIZAGEM: "Curso/Aprendizagem",
  CARGO_CONFIANCA: "Cargo de confiança",
  OUTRO: "Não identificado",
};

/** Os mesmos status que ficam de fora do cálculo de absenteísmo lá na importação (src/actions/attendance-import.ts) — mantidos em sincronia de propósito. */
const STATUS_FORA_DO_CALCULO = new Set([
  "FERIAS",
  "FOLGA",
  "FERIADO",
  "SEM_JORNADA",
  "CARGO_CONFIANCA",
  "ABONO",
  "DISPENSADO",
  "OUTRO",
]);

/**
 * Lista completa de ocorrências (todo dia que não foi presença normal), uma
 * linha por colaborador por dia — cruzando o AttendanceRecord (que tem o
 * status real do dia: falta, atestado, licença, férias, etc.) com o Absence
 * correspondente (que tem o atestado e as horas perdidas). Essa é a ÚNICA
 * fonte usada por todo o resto da aba operacional, pra nunca mais existir
 * divergência entre "quantas faltas" e "quantas com atestado".
 *
 * Antes, a tabela de faltas só olhava quem tinha status FALTOU — só que, com a
 * classificação corrigida, quem tem atestado/licença NUNCA fica com status
 * FALTOU (fica ATESTADO/LICENCA). Por isso a coluna "com atestado" sempre
 * dava 0: estava procurando atestado dentro do grupo que, por definição, não
 * tem atestado.
 */
export async function getOcorrenciasDetalhadas(filters: ExecutiveFilters, limit = 50000): Promise<OcorrenciaDetalhada[]> {
  const range = resolvePeriod(filters.period);

  const records = await prisma.attendanceRecord.findMany({
    where: {
      date: { gte: range.start, lte: range.end },
      status: { not: "PRESENTE" },
      ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}),
    },
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

  if (records.length === 0) return [];

  const employeeIds = Array.from(new Set(records.map((r) => r.employeeId)));
  const dates = records.map((r) => r.date.getTime());
  const minDate = new Date(Math.min(...dates));
  const maxDate = new Date(Math.max(...dates));

  const absences = await prisma.absence.findMany({
    where: { employeeId: { in: employeeIds }, date: { gte: minDate, lte: maxDate } },
    select: { employeeId: true, date: true, hasCertificate: true, hoursLost: true },
  });
  const absenceByKey = new Map(absences.map((a) => [`${a.employeeId}_${a.date.toISOString().slice(0, 10)}`, a]));

  return records.map((r) => {
    const key = `${r.employeeId}_${r.date.toISOString().slice(0, 10)}`;
    const abs = absenceByKey.get(key);
    const status = r.status as string;
    return {
      date: r.date,
      employeeName: r.employee.name,
      registration: r.employee.registration,
      setorPrincipal: r.employee.costCenter?.name ?? null,
      setorSecundario: r.employee.secondaryCostCenter?.name ?? null,
      status,
      motivoLabel: STATUS_LABELS[status] ?? status,
      entraNoCalculo: !STATUS_FORA_DO_CALCULO.has(status),
      hasCertificate: abs?.hasCertificate ?? false,
      hoursLost: abs?.hoursLost ?? 0,
      mesKey: monthKey(r.date),
    };
  });
}

export interface OcorrenciasMesResumo {
  mes: string;
  label: string;
  total: number;
  contamCalculo: number;
  comAtestado: number;
  semAtestado: number;
}

/** Agrupa as ocorrências por mês — total de ocorrências, quantas entram no cálculo e o mix atestado/sem atestado dessas. */
export function resumoOcorrenciasPorMes(ocorrencias: OcorrenciaDetalhada[]): OcorrenciasMesResumo[] {
  const map = new Map<string, OcorrenciasMesResumo>();
  for (const o of ocorrencias) {
    const cur = map.get(o.mesKey) ?? {
      mes: o.mesKey,
      label: monthLabelsPtBR([o.mesKey])[0],
      total: 0,
      contamCalculo: 0,
      comAtestado: 0,
      semAtestado: 0,
    };
    cur.total += 1;
    if (o.entraNoCalculo) {
      cur.contamCalculo += 1;
      if (o.hasCertificate) cur.comAtestado += 1;
      else cur.semAtestado += 1;
    }
    map.set(o.mesKey, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.mes.localeCompare(a.mes));
}

export interface OcorrenciasSetorResumo {
  setor: string;
  total: number;
  comAtestado: number;
  semAtestado: number;
}

/** Agrupa por setor (principal ou secundário) só as ocorrências que ENTRAM NO CÁLCULO — abono, férias, folga etc. não fazem sentido num ranking de faltas por setor. */
export function resumoOcorrenciasPorSetor(
  ocorrencias: OcorrenciaDetalhada[],
  campo: "setorPrincipal" | "setorSecundario"
): OcorrenciasSetorResumo[] {
  const map = new Map<string, OcorrenciasSetorResumo>();
  for (const o of ocorrencias) {
    if (!o.entraNoCalculo) continue;
    const valor = o[campo];
    if (campo === "setorSecundario" && !valor) continue; // nem todo colaborador tem setor secundário
    const setor = valor ?? "Não informado";
    const cur = map.get(setor) ?? { setor, total: 0, comAtestado: 0, semAtestado: 0 };
    cur.total += 1;
    if (o.hasCertificate) cur.comAtestado += 1;
    else cur.semAtestado += 1;
    map.set(setor, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}
