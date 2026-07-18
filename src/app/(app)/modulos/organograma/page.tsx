import { Network } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Card, CardContent } from "@/components/ui/card";
import { AreaOrgChartNode } from "@/components/dashboard/area-org-chart-node";
import { AddManagerDialog } from "@/components/admin/add-manager-dialog";
import { getAreaOrgTree, getManagersFlat, MAIN_AREAS } from "@/services/organograma";
import { prisma } from "@/lib/prisma";

export default async function OrganogramaPage({
  searchParams,
}: {
  searchParams: Promise<{ setor?: string }>;
}) {
  const params = await searchParams;
  const selectedArea = MAIN_AREAS.includes(params.setor as (typeof MAIN_AREAS)[number]) ? (params.setor as string) : MAIN_AREAS[0];

  const [tree, allManagers, employees] = await Promise.all([
    getAreaOrgTree(selectedArea),
    getManagersFlat(),
    prisma.employee.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <ModuleHeader
          title="Organograma"
          description="Estrutura hierárquica por setor principal — gestores no topo, colaboradores reais embaixo."
          moduleKey="organograma"
        />
        <AddManagerDialog managers={allManagers} employees={employees} />
      </div>

      <div className="flex flex-wrap gap-2">
        {MAIN_AREAS.map((area) => {
          const isActive = area === selectedArea;
          const activeClass = "bg-navy text-cream dark:bg-gold dark:text-navy-dark";
          const inactiveClass = "bg-muted text-muted-foreground hover:bg-muted/70";
          const pillClass = "rounded-full px-4 py-1.5 text-sm font-medium transition-colors " + (isActive ? activeClass : inactiveClass);
          const href = "?setor=" + encodeURIComponent(area);
          return (
            <a key={area} href={href} className={pillClass}>
              {area}
            </a>
          );
        })}
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-8">
          {tree.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/12 text-gold-text">
                <Network className="h-6 w-6" />
              </div>
              <p className="text-sm text-muted-foreground max-w-sm">
                Nenhum gestor cadastrado nesse setor ainda. Clique em &quot;Adicionar gestor&quot; para começar.
              </p>
            </div>
          ) : (
            <ul className="flex w-fit min-w-full justify-center gap-8">
              {tree.map((root) => (
                <AreaOrgChartNode key={root.id} node={root} allManagers={allManagers} isRoot />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
