import { prisma } from "@/lib/prisma";
import type { ExecutiveFilters } from "@/services/dashboard-executivo";

const LATEST_CYCLE = "2026-S1";

export async function getDesempenhoKpis(filters: ExecutiveFilters) {
  const reviews = await prisma.performanceReview.findMany({
    where: { cycle: LATEST_CYCLE, ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}) },
  });

  const activeEmployeesCount = await prisma.employee.count({
    where: { isActive: true, ...(filters.unitId ? { unitId: filters.unitId } : {}) },
  });

  const avgScore = reviews.reduce((acc, r) => acc + r.score, 0) / (reviews.length || 1);
  const pdiConcluded = reviews.filter((r) => r.pdiStatus === "CONCLUIDO").length;
  const pdiInProgress = reviews.filter((r) => r.pdiStatus === "EM_ANDAMENTO").length;
  const pdiPending = reviews.filter((r) => r.pdiStatus === "PENDENTE").length;

  return {
    reviewedCount: reviews.length,
    coverageRate: activeEmployeesCount > 0 ? reviews.length / activeEmployeesCount : 0,
    avgScore,
    pdiConcluded,
    pdiInProgress,
    pdiPending,
  };
}

export async function getNineBoxDistribution(filters: ExecutiveFilters) {
  const reviews = await prisma.performanceReview.findMany({
    where: { cycle: LATEST_CYCLE, ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}) },
    select: { boxLabel: true },
  });
  const map = new Map<string, number>();
  for (const r of reviews) {
    const label = r.boxLabel ?? "Não classificado";
    map.set(label, (map.get(label) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

export async function getDesempenhoTable(filters: ExecutiveFilters) {
  return prisma.performanceReview.findMany({
    where: { cycle: LATEST_CYCLE, ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}) },
    include: { employee: { include: { position: true, unit: true } } },
    orderBy: { score: "desc" },
    take: 50,
  });
}
