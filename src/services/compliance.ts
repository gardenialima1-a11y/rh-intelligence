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

export async function getComplianceTable(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  return prisma.complianceEvent.findMany({
    where: { date: { gte: range.start, lte: range.end }, ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}) },
    include: { employee: { include: { unit: true } }, reason: true },
    orderBy: { date: "desc" },
    take: 50,
  });
}
