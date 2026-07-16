import { Network } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Card, CardContent } from "@/components/ui/card";
import { OrgChartNode } from "@/components/dashboard/org-chart-node";
import { AddManagerDialog } from "@/components/admin/add-manager-dialog";
import { getOrgChartTree, getManagersFlat } from "@/services/organograma";

export default async function OrganogramaPage() {
  const [tree, allManagers] = await Promise.all([getOrgChartTree(), getManagersFlat()]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <ModuleHeader
          title="Organograma"
          description="Estrutura hierárquica de gestores e o tamanho das equipes sob cada um."
          moduleKey="organograma"
        />
        <AddManagerDialog managers={allManagers} />
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-8">
          {tree.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/12 text-gold-text">
                <Network className="h-6 w-6" />
              </div>
              <p className="text-sm text-muted-foreground max-w-sm">
                Nenhum gestor cadastrado ainda. Clique em &quot;Adicionar gestor&quot; para começar a montar o organograma.
              </p>
            </div>
          ) : (
            <ul className="flex w-fit min-w-full justify-center gap-8">
              {tree.map((root) => (
                <OrgChartNode key={root.id} node={root} allManagers={allManagers} isRoot />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
