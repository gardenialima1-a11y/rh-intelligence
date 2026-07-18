import { prisma } from "@/lib/prisma";
import { MovementType } from "@prisma/client";
import { resolvePeriod, lastNMonthsKeys } from "@/services/period";
import type { ExecutiveFilters } from "@/services/dashboard-executivo";

async function activeCountAt(date: Date, unitId?: string) {
  return prisma.employee.count({
    where: {
      admissionDate: { lte: date },
      OR: [{ terminationDate: null }, { terminationDate: { gt: date } }],
      ...(unitId ? { unitId } : {}),
    },
  });
}

export interface InternalMobilityKpis {
  promotions: number;
  transfers: number;
  mobilityRate: number;
  promotionRate: number;
}

/**
 * Taxa de Mobilidade Interna — (promoções + transferências) / headcount médio.
 * Indicador estratégico de desenvolvimento de carreira e retenção: mercados
 * de referência (Mercer, LinkedIn Talent) associam mobilidade interna saudável
 * a menor turnover voluntário e maior engajamento.
 */
export async function getInternalMobilityKpis(filters: ExecutiveFilters): Promise<InternalMobilityKpis> {
  const range = resolvePeriod(filters.period);

  const [promotions, transfers, hcStart, hcEnd] = await Promise.all([
    prisma.movement.count({
      where: { type: MovementType.PROMOCAO, date: { gte: range.start, lte: range.end }, ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}) },
    }),
    prisma.movement.count({
      where: { type: MovementType.TRANSFERENCIA, date: { gte: range.start, lte: range.end }, ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}) },
    }),
    activeCountAt(range.start, filters.unitId),
    activeCountAt(range.end, filters.unitId),
  ]);

  const avgHeadcount = (hcStart + hcEnd) / 2 || 1;

  return {
    promotions,
    transfers,
    mobilityRate: (promotions + transfers) / avgHeadcount,
    promotionRate: promotions / avgHeadcount,
  };
}

export async function getMobilityTrend(filters: ExecutiveFilters) {
  const months = lastNMonthsKeys(12);
  return Promise.all(
    months.map(async (key) => {
      const [y, m] = key.split("-").map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0, 23, 59, 59);
      return prisma.movement.count({
        where: {
          type: { in: [MovementType.PROMOCAO, MovementType.TRANSFERENCIA] },
          date: { gte: start, lte: end },
          ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}),
        },
      });
    })
  );
}

export async function getLiderancaKpis(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);

  const managers = await prisma.manager.findMany({
    include: {
      employees: {
        where: filters.unitId ? { unitId: filters.unitId } : {},
        select: { id: true },
      },
    },
  });

  const totalManagers = managers.length;
  const avgSpanOfControl = managers.reduce((acc, m) => acc + m.employees.length, 0) / (totalManagers || 1);

  const managerTerminations = await prisma.movement.count({
    where: {
      type: MovementType.DESLIGAMENTO,
      date: { gte: range.start, lte: range.end },
      employee: { manager: { level: { in: ["Gerência", "Liderança"] } } },
    },
  });

  const highPotential = await prisma.performanceReview.count({
    where: { cycle: "2026-S1", boxLabel: { contains: "Alto Potencial" } },
  });

  return {
    totalManagers,
    avgSpanOfControl,
    managerTerminations,
    highPotential,
  };
}

export async function getSpanOfControlRanking(filters: ExecutiveFilters) {
  const managers = await prisma.manager.findMany({
    select: {
      name: true,
      employees: {
        where: filters.unitId ? { unitId: filters.unitId, isActive: true } : { isActive: true },
        select: { id: true },
      },
    },
  });
  return managers
    .map((m) => ({ name: m.name, value: m.employees.length }))
    .filter((m) => m.value > 0)
    .sort((a, b) => b.value - a.value);
}

export async function getSuccessionTable(filters: ExecutiveFilters) {
  const [managers, allEmployees] = await Promise.all([
    prisma.manager.findMany({
      where: filters.unitId ? { employees: { some: { unitId: filters.unitId } } } : {},
      select: { id: true, name: true, area: true, reportsToId: true },
      take: 20,
    }),
    // Busca TODOS os gestores (pra montar a árvore completa) e todos os
    // colaboradores ativos, pra poder somar a equipe de cada gestor
    // incluindo quem está por baixo dos gestores que reportam a ele —
    // não só quem reporta diretamente.
    prisma.employee.findMany({
      where: { isActive: true, ...(filters.unitId ? { unitId: filters.unitId } : {}) },
      select: {
        id: true,
        name: true,
        managerId: true,
        position: { select: { name: true } },
        reviews: { where: { cycle: "2026-S1" }, take: 1, select: { boxLabel: true } },
      },
    }),
  ]);

  const allManagers = await prisma.manager.findMany({ select: { id: true, reportsToId: true } });
  const childrenByManager = new Map<string, string[]>();
  for (const m of allManagers) {
    if (!m.reportsToId) continue;
    const list = childrenByManager.get(m.reportsToId) ?? [];
    list.push(m.id);
    childrenByManager.set(m.reportsToId, list);
  }

  const employeesByManager = new Map<string, typeof allEmployees>();
  for (const e of allEmployees) {
    if (!e.managerId) continue;
    const list = employeesByManager.get(e.managerId) ?? [];
    list.push(e);
    employeesByManager.set(e.managerId, list);
  }

  /** Soma a equipe do gestor com toda a cadeia de gestores abaixo dele. */
  function collectTeam(managerId: string, seen = new Set<string>()): typeof allEmployees {
    if (seen.has(managerId)) return [];
    seen.add(managerId);
    const direct = employeesByManager.get(managerId) ?? [];
    const childManagerIds = childrenByManager.get(managerId) ?? [];
    const indirect = childManagerIds.flatMap((childId) => collectTeam(childId, seen));
    return [...direct, ...indirect];
  }

  return managers.map((m) => {
    const team = collectTeam(m.id);
    const potentialSuccessors = team.filter((e) => e.reviews[0]?.boxLabel?.includes("Alto Potencial")).length;
    return { ...m, team, teamSize: team.length, potentialSuccessors };
  });
}
