import { prisma } from "@/lib/prisma";
import { resolvePeriod } from "@/services/period";
import type { ExecutiveFilters } from "@/services/dashboard-executivo";

export async function getComplianceKpis(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  const where = {
    date: { gte: range.start, lte: range.end },
    ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}),
  };

  const events = await prisma.complianceEvent.findMany({ where });
  const advertencias = events.filter((e) => e.type === "ADVERTENCIA").length;
  const suspensoes = events.filter((e) => e.type === "SUSPENSAO").length;
  const processos = events.filter((e) => e.type === "PROCESSO").length;
  const estimatedLiability = events.reduce((acc, e) => acc + (e.estimatedCost ?? 0), 0);

  return { advertencias, suspensoes, processos, estimatedLiability, total: events.length };
}

export async function getComplianceByReason(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  const events = await prisma.complianceEvent.findMany({
    where: { date: { gte: range.start, lte: range.end }, ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}) },
    include: { reason: true },
  });
  const map = new Map<string, number>();
  for (const e of events) {
    const label = e.reason?.label ?? "Não informado";
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export interface DisciplinaryTimelineEntry {
  id: string;
  date: Date;
  type: string;
  reason: string | null;
}

export interface DisciplinaryRankingRow {
  employeeId: string;
  employeeName: string;
  unitName: string;
  advertencias: number;
  suspensoes: number;
  processos: number;
  total: number;
  lastEventDate: Date;
  suggestion: string;
  timeline: DisciplinaryTimelineEntry[];
}

/**
 * Sugestão de próximo passo com base numa régua simples de disciplina
 * progressiva (prática comum de RH — não é uma regra da CLT, é só um
 * apoio à decisão; a palavra final é sempre de quem está analisando o caso).
 */
function suggestNextAction(advertencias: number, suspensoes: number): string {
  if (suspensoes >= 2) return "Avaliar desligamento por justa causa";
  if (suspensoes >= 1) return "Reincidência: avaliar desligamento";
  if (advertencias >= 3) return "Considerar suspensão";
  if (advertencias >= 1) return "Acompanhar";
  return "Sem histórico relevante";
}

/**
 * Ranking de colaboradores por medidas disciplinares (advertências e
 * suspensões), com linha do tempo de cada um. Usa o histórico completo
 * (não só o período filtrado), porque decisão de disciplina progressiva
 * depende do histórico inteiro da pessoa, não só do mês corrente.
 */
export async function getDisciplinaryRanking(filters: ExecutiveFilters): Promise<DisciplinaryRankingRow[]> {
  const events = await prisma.complianceEvent.findMany({
    where: { ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}) },
    include: { employee: { include: { unit: true } }, reason: true },
    orderBy: { date: "asc" },
  });

  const byEmployee = new Map<string, DisciplinaryRankingRow>();
  for (const e of events) {
    if (!["ADVERTENCIA", "SUSPENSAO", "PROCESSO"].includes(e.type)) continue;

    let row = byEmployee.get(e.employeeId);
    if (!row) {
      row = {
        employeeId: e.employeeId,
        employeeName: e.employee.name,
        unitName: e.employee.unit.name,
        advertencias: 0,
        suspensoes: 0,
        processos: 0,
        total: 0,
        lastEventDate: e.date,
        suggestion: "",
        timeline: [],
      };
      byEmployee.set(e.employeeId, row);
    }

    if (e.type === "ADVERTENCIA") row.advertencias += 1;
    if (e.type === "SUSPENSAO") row.suspensoes += 1;
    if (e.type === "PROCESSO") row.processos += 1;
    row.total += 1;
    if (e.date > row.lastEventDate) row.lastEventDate = e.date;
    row.timeline.push({ id: e.id, date: e.date, type: e.type, reason: e.reason?.label ?? null });
  }

  const rows = Array.from(byEmployee.values());
  for (const row of rows) {
    row.suggestion = suggestNextAction(row.advertencias, row.suspensoes);
  }

  return rows.sort(
    (a, b) => b.suspensoes - a.suspensoes || b.advertencias - a.advertencias || b.total - a.total
  );
}

export async function getComplianceTable(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  return prisma.complianceEvent.findMany({
    where: { date: { gte: range.start, lte: range.end }, ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}) },
    include: { employee: { include: { unit: true } }, reason: true },
    orderBy: { date: "desc" },
    take: 50,
  });
}
