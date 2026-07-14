import { resolveScopedFilters } from "@/lib/scope";
import { BarChart3, ClipboardCheck, Star, Target } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { ModuleViewTabs } from "@/components/dashboard/module-view-tabs";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RankingBarChart } from "@/components/dashboard/ranking-bar-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatPercent } from "@/lib/utils";
import { getDesempenhoKpis, getNineBoxDistribution, getDesempenhoTable } from "@/services/desempenho";

const PDI_VARIANT: Record<string, "success" | "warning" | "outline"> = {
  CONCLUIDO: "success",
  EM_ANDAMENTO: "warning",
  PENDENTE: "outline",
};

export default async function DesempenhoPage({
  searchParams,
}: {
  searchParams: Promise<{ unidade?: string; periodo?: string }>;
}) {
  const params = await searchParams;
  const filters = await resolveScopedFilters(params);

  const [kpis, nineBox, table] = await Promise.all([
    getDesempenhoKpis(filters),
    getNineBoxDistribution(filters),
    getDesempenhoTable(filters),
  ]);

  const executive = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Colaboradores avaliados" value={formatPercent(kpis.coverageRate)} icon={ClipboardCheck} accent="navy" />
        <KpiCard label="Nota média" value={kpis.avgScore.toFixed(1)} icon={Star} accent="gold" />
        <KpiCard label="PDIs concluídos" value={formatNumber(kpis.pdiConcluded)} icon={Target} accent="success" />
        <KpiCard label="PDIs pendentes" value={formatNumber(kpis.pdiPending)} icon={Target} accent="danger" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Distribuição na matriz 9-box</CardTitle>
        </CardHeader>
        <CardContent>
          {nineBox.length > 0 ? <RankingBarChart data={nineBox} /> : <p className="text-sm text-muted-foreground">Sem avaliações no ciclo.</p>}
        </CardContent>
      </Card>
    </div>
  );

  const managerial = (
    <Card>
      <CardHeader>
        <CardTitle>9-box — visão gerencial</CardTitle>
      </CardHeader>
      <CardContent>
        {nineBox.length > 0 ? <RankingBarChart data={nineBox} color="#B8935A" /> : <p className="text-sm text-muted-foreground">Sem dados.</p>}
      </CardContent>
    </Card>
  );

  const operational = (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Avaliações do ciclo 2026-S1</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead>9-box</TableHead>
                <TableHead>PDI</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.employee.name}</TableCell>
                  <TableCell>{r.employee.position?.name ?? "—"}</TableCell>
                  <TableCell>{r.employee.unit.name}</TableCell>
                  <TableCell>{r.score.toFixed(1)}</TableCell>
                  <TableCell>{r.boxLabel ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={PDI_VARIANT[r.pdiStatus ?? ""] ?? "outline"}>{r.pdiStatus ?? "—"}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  const analytical = (
    <Card>
      <CardHeader>
        <CardTitle>Indicadores analíticos</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="Cobertura do ciclo" value={formatPercent(kpis.coverageRate)} icon={ClipboardCheck} accent="navy" />
        <KpiCard label="Nota média" value={kpis.avgScore.toFixed(1)} icon={BarChart3} accent="gold" />
        <KpiCard label="PDIs em andamento" value={formatNumber(kpis.pdiInProgress)} icon={Target} accent="gold" />
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader title="Avaliação de Desempenho" description="Ciclos de avaliação, matriz 9-box e planos de desenvolvimento individual." moduleKey="desempenho" />
      <ModuleViewTabs executive={executive} managerial={managerial} operational={operational} analytical={analytical} />
    </div>
  );
}
