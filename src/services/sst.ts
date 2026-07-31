import { prisma } from "@/lib/prisma";
import { resolvePeriod, lastNMonthsKeys } from "@/services/period";
import type { ExecutiveFilters } from "@/services/dashboard-executivo";

export const INCIDENT_TYPE_LABEL: Record<string, string> = {
  ACIDENTE: "Acidente",
  NEAR_MISS: "Quase acidente",
  INCIDENTE_DESVIO: "Incidente/Desvio",
};

/** Critério usado pra considerar um acidente como gerador de estabilidade acidentária: precisa ter CAT emitida e 15 dias ou mais de afastamento (referência de mercado: é a partir daí que o INSS costuma assumir o benefício por acidente de trabalho, código B91). */
const STABILITY_MIN_DAYS_LOST = 15;
const STABILITY_MONTHS = 12;

export async function getSstKpis(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  const where = {
    date: { gte: range.start, lte: range.end },
    ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}),
  };

  const incidents = await prisma.safetyIncident.findMany({ where });
  const accidents = incidents.filter((i) => i.type === "ACIDENTE");
  const nearMisses = incidents.filter((i) => i.type === "NEAR_MISS");
  const incidentesDesvios = incidents.filter((i) => i.type === "INCIDENTE_DESVIO");
  const withCAT = incidents.filter((i) => i.hasCAT).length;
  const totalDaysLost = incidents.reduce((acc, i) => acc + i.daysLost, 0);

  const activeEmployees = await prisma.employee.count({
    where: { isActive: true, ...(filters.unitId ? { unitId: filters.unitId } : {}) },
  });

  const estimatedHHT = activeEmployees * 8 * 22 * (range.months || 1);
  const frequencyRate = estimatedHHT > 0 ? (accidents.length * 1_000_000) / estimatedHHT : 0;
  const severityRate = estimatedHHT > 0 ? (totalDaysLost * 1_000_000) / estimatedHHT : 0;

  return {
    accidentsCount: accidents.length,
    nearMissesCount: nearMisses.length,
    incidentesDesviosCount: incidentesDesvios.length,
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
  return Array.from(map.entries()).map(([name, value]) => ({ name: INCIDENT_TYPE_LABEL[name] ?? name, value }));
}

export interface IncidentTypeBreakdownRow {
  type: string;
  label: string;
  total: number;
  comCAT: number;
  diasPerdidos: number;
}

/** Levantamento por tipo: quantidade, quantos tiveram CAT emitida e total de dias perdidos, pra cada tipo (Acidente, Quase acidente, Incidente/Desvio). */
export async function getIncidentsByTypeBreakdown(filters: ExecutiveFilters): Promise<IncidentTypeBreakdownRow[]> {
  const range = resolvePeriod(filters.period);
  const incidents = await prisma.safetyIncident.findMany({
    where: {
      date: { gte: range.start, lte: range.end },
      ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}),
    },
    select: { type: true, hasCAT: true, daysLost: true },
  });

  const map = new Map<string, IncidentTypeBreakdownRow>();
  for (const i of incidents) {
    const cur = map.get(i.type) ?? { type: i.type, label: INCIDENT_TYPE_LABEL[i.type] ?? i.type, total: 0, comCAT: 0, diasPerdidos: 0 };
    cur.total += 1;
    if (i.hasCAT) cur.comCAT += 1;
    cur.diasPerdidos += i.daysLost;
    map.set(i.type, cur);
  }

  // Sempre mostra os 3 tipos, mesmo com 0 ocorrências, pra dar a visão completa.
  for (const type of Object.keys(INCIDENT_TYPE_LABEL)) {
    if (!map.has(type)) map.set(type, { type, label: INCIDENT_TYPE_LABEL[type], total: 0, comCAT: 0, diasPerdidos: 0 });
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export interface AccidentStabilityRow {
  incidentId: string;
  employeeId: string;
  employeeName: string;
  isActive: boolean;
  accidentDate: Date;
  returnDate: Date | null;
  daysLost: number;
  stabilityStart: Date;
  stabilityEnd: Date;
  emEstabilidade: boolean;
  diasRestantes: number;
}

/**
 * Lista de colaboradores com estabilidade acidentária vigente ou recente:
 * acidentes com CAT emitida e 15 dias ou mais de afastamento (critério que
 * costuma indicar que o INSS assumiu o benefício, código B91 — confirme
 * sempre a situação real de cada caso junto ao INSS/jurídico, isso aqui é
 * uma estimativa organizacional, não uma certidão legal). A estabilidade
 * vale 12 meses a partir do retorno ao trabalho (ou, se o retorno ainda não
 * foi informado, a partir de data + dias afastado, como estimativa).
 * Não é filtrada pelo período do topo da tela — estabilidade pode valer por
 * até 1 ano, então olha o histórico completo sempre.
 */
export async function getAccidentStability(filters: ExecutiveFilters): Promise<AccidentStabilityRow[]> {
  const incidents = await prisma.safetyIncident.findMany({
    where: {
      type: "ACIDENTE",
      hasCAT: true,
      daysLost: { gte: STABILITY_MIN_DAYS_LOST },
      employeeId: { not: null },
      ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}),
    },
    include: { employee: { select: { id: true, name: true, isActive: true } } },
    orderBy: { date: "desc" },
  });

  const now = new Date();
  const rows: AccidentStabilityRow[] = incidents
    .filter((i) => i.employee)
    .map((i) => {
      const stabilityStart = i.returnDate ?? new Date(i.date.getTime() + i.daysLost * 86400000);
      const stabilityEnd = new Date(stabilityStart);
      stabilityEnd.setMonth(stabilityEnd.getMonth() + STABILITY_MONTHS);
      const diasRestantes = Math.ceil((stabilityEnd.getTime() - now.getTime()) / 86400000);

      return {
        incidentId: i.id,
        employeeId: i.employee!.id,
        employeeName: i.employee!.name,
        isActive: i.employee!.isActive,
        accidentDate: i.date,
        returnDate: i.returnDate,
        daysLost: i.daysLost,
        stabilityStart,
        stabilityEnd,
        emEstabilidade: diasRestantes > 0,
        diasRestantes,
      };
    });

  return rows.sort((a, b) => (a.emEstabilidade === b.emEstabilidade ? b.stabilityEnd.getTime() - a.stabilityEnd.getTime() : a.emEstabilidade ? -1 : 1));
}

export interface DaysWithoutAccidentsInfo {
  diasAtuais: number;
  ultimoAcidente: Date | null;
  recordeDias: number;
  totalAcidentesRegistrados: number;
}

/**
 * Quadro "dias sem acidentes" — comum em painéis de fábrica. Calcula
 * automaticamente a partir do último ACIDENTE registrado no sistema (não
 * conta quase acidente nem incidente/desvio, só acidente de verdade). Se
 * nunca houve acidente registrado, conta a partir da admissão mais antiga
 * (aproximação do "início da operação"). Também calcula o recorde histórico
 * (maior intervalo já visto entre dois acidentes seguidos), pra comparação.
 */
export async function getDaysWithoutAccidents(filters: ExecutiveFilters): Promise<DaysWithoutAccidentsInfo> {
  const accidents = await prisma.safetyIncident.findMany({
    where: { type: "ACIDENTE", ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}) },
    select: { date: true },
    orderBy: { date: "asc" },
  });

  const now = new Date();

  if (accidents.length === 0) {
    const oldest = await prisma.employee.aggregate({ _min: { admissionDate: true } });
    const start = oldest._min.admissionDate ?? now;
    const diasAtuais = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86400000));
    return { diasAtuais, ultimoAcidente: null, recordeDias: diasAtuais, totalAcidentesRegistrados: 0 };
  }

  let recordeDias = 0;
  for (let i = 1; i < accidents.length; i++) {
    const gap = Math.floor((accidents[i].date.getTime() - accidents[i - 1].date.getTime()) / 86400000);
    if (gap > recordeDias) recordeDias = gap;
  }

  const ultimoAcidente = accidents[accidents.length - 1].date;
  const diasAtuais = Math.max(0, Math.floor((now.getTime() - ultimoAcidente.getTime()) / 86400000));
  if (diasAtuais > recordeDias) recordeDias = diasAtuais;

  return { diasAtuais, ultimoAcidente, recordeDias, totalAcidentesRegistrados: accidents.length };
}

/**
 * Analytics real de absenteísmo (SST): maiores ausentes, setor principal,
 * setor secundário, motivos e sazonalidade. Tudo calculado ao vivo a partir
 * da tabela Absence — conforme novos atestados/ausências são cadastrados,
 * esses gráficos mudam automaticamente, sem qualquer valor fixo.
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
      employee: {
        select: {
          name: true,
          costCenter: { select: { name: true } },
          secondaryCostCenter: { select: { name: true } },
        },
      },
      reason: { select: { label: true } },
    },
  });

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

  const byPrimarySector = new Map<string, number>();
  for (const a of absences) {
    const label = a.employee?.costCenter?.name ?? "Sem setor principal";
    byPrimarySector.set(label, (byPrimarySector.get(label) ?? 0) + a.hoursLost);
  }
  const primarySectors = Array.from(byPrimarySector.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value: Number(value.toFixed(1)) }));

  const bySecondarySector = new Map<string, number>();
  for (const a of absences) {
    if (!a.employee?.secondaryCostCenter) continue;
    const label = a.employee.secondaryCostCenter.name;
    bySecondarySector.set(label, (bySecondarySector.get(label) ?? 0) + a.hoursLost);
  }
  const secondarySectors = Array.from(bySecondarySector.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value: Number(value.toFixed(1)) }));

  const byReason = new Map<string, number>();
  for (const a of absences) {
    const label = a.reason?.label ?? "Sem motivo informado";
    byReason.set(label, (byReason.get(label) ?? 0) + a.hoursLost);
  }
  const reasons = Array.from(byReason.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value: Number(value.toFixed(1)) }));

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

  return { topAbsentees, primarySectors, secondarySectors, reasons, seasonality, totalOccurrences: absences.length };
}
