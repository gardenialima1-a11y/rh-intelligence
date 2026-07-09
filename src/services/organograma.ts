import { prisma } from "@/lib/prisma";
import { buildOrgTree, type OrgChartNode } from "@/lib/analytics/org-tree";

export type OrgNode = OrgChartNode;

/**
 * Monta a árvore do organograma a partir da hierarquia de gestores
 * (Manager.reportsToId) e conta quantos colaboradores ativos cada
 * gestor tem diretamente sob si.
 */
export async function getOrgChartTree(): Promise<OrgNode[]> {
  const [managers, counts] = await Promise.all([
    prisma.manager.findMany({ select: { id: true, name: true, area: true, level: true, reportsToId: true } }),
    prisma.employee.groupBy({
      by: ["managerId"],
      where: { isActive: true, managerId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const countByManager = new Map(counts.map((c) => [c.managerId as string, c._count._all]));

  return buildOrgTree(
    managers.map((m) => ({
      id: m.id,
      name: m.name,
      area: m.area,
      level: m.level,
      reportsToId: m.reportsToId,
      directEmployeeCount: countByManager.get(m.id) ?? 0,
    }))
  );
}

export async function getManagersFlat() {
  return prisma.manager.findMany({ select: { id: true, name: true, area: true }, orderBy: { name: "asc" } });
}
