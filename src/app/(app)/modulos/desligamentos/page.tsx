import { resolveScopedFilters } from "@/lib/scope";
import { UserX, Wallet, TrendingDown, ShieldAlert } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { ModuleViewTabs } from "@/components/dashboard/module-view-tabs";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { RankingBarChart } from "@/components/dashboard/ranking-bar-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatPercent, formatCurrency, formatDate } from "@/lib/utils";
import { lastNMonthsKeys, monthLabelsPtBR } from "@/services/period";
import { TableCardHeader } from "@/components/dashboard/table-card-header";
import { getDesligamentosKpis, getDesligamentosByManager, getDesligamentosTable } from "@/services/desligamentos";

export default async function DesligamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ unidade?: string; periodo?: string }>;
}) {
  const params = await searchParams;
  const filters = await resolveScopedFilters(params);

  const [kpis, byManager, table] = await Promise.all([
    getDesligamentosKpis(filters),
    getDesligamentosByManager(filters),
    getDesligamentosTable(filters),
  ]);

  const monthLabels = monthLabelsPtBR(lastNMonthsKeys(12));

  const executive = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Desligamentos no período" value={formatNumber(kpis.current)} icon={UserX} deltaLabel={formatPercent(Math.abs(kpis.delta))} deltaDirection={kpis.delta >= 0 ? "up" : "down"} deltaSentiment={kpis.delta >= 0 ? "negative" : "positive"} sparklineData={kpis.series} accent="danger" />
        <KpiCard label="Custo rescisório total" value={formatCurrency(kpis.totalCost)} icon={Wallet} accent="danger" />
        <KpiCard label="Custo médio por desligamento" value={formatCurrency(kpis.avgCost)} icon={Wallet} accent="gold" />
        <KpiCard label="Voluntário x Involuntário" value={`${kpis.voluntaryCount} / ${kpis.involuntaryCount}`} icon={TrendingDown} accent="navy" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Desligamentos — 12 meses</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart data={kpis.series} labels={monthLabels} color="#B23A48" />
        </CardContent>
      </Card>
    </div>
  );

  const managerial = (
    <Card>
      <CardHeader>
        <CardTitle>Desligamentos por gestor</CardTitle>
      </CardHeader>
      <CardContent>
        {byManager.length > 0 ? <RankingBarChart data={byManager} color="#B23A48" /> : <p className="text-sm text-muted-foreground">Sem desligamentos no período.</p>}
      </CardContent>
    </Card>
  );

  const operational = (
    <Card>
      <TableCardHeader
        title="Desligamentos no período"
        filename="desligamentos"
        data={table.map((m) => ({
          colaborador: m.employee.name,
          cargo: m.employee.position?.name ?? "",
          gestor: m.employee.manager?.name ?? "",
          data: m.date,
          tipo: m.voluntary ? "Voluntário" : "Involuntário",
          motivo: m.reason?.label ?? "",
          custo: m.costValue ?? "",
        }))}
        columns={[
          { key: "colaborador", label: "Colaborador" },
          { key: "cargo", label: "Cargo" },
          { key: "gestor", label: "Gestor" },
          { key: "data", label: "Data" },
          { key: "tipo", label: "Tipo" },
          { key: "motivo", label: "Motivo" },
          { key: "custo", label: "Custo" },
        ]}
      />
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Gestor</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Custo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.map((m) => (
              <TableRow key={m.id}>
                <TableCell>{m.employee.name}</TableCell>
                <TableCell>{m.employee.position?.name ?? "—"}</TableCell>
                <TableCell>{m.employee.manager?.name ?? "—"}</TableCell>
                <TableCell>{formatDate(m.date)}</TableCell>
                <TableCell>
                  <Badge variant={m.voluntary ? "warning" : "danger"}>{m.voluntary ? "Voluntário" : "Involuntário"}</Badge>
                </TableCell>
                <TableCell>{m.reason?.label ?? "—"}</TableCell>
                <TableCell>{m.costValue ? formatCurrency(m.costValue) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  const analytical = (
    <Card>
      <CardHeader>
        <CardTitle>Indicadores de custo e risco</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="Custo total" value={formatCurrency(kpis.totalCost)} icon={Wallet} accent="danger" />
        <KpiCard label="Custo médio" value={formatCurrency(kpis.avgCost)} icon={Wallet} accent="gold" />
        <KpiCard label="Involuntários" value={formatNumber(kpis.involuntaryCount)} icon={ShieldAlert} accent="navy" />
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader title="Desligamentos" description="Análise de saídas, custos rescisórios e causas raiz." moduleKey="desligamentos" />
      <ModuleViewTabs executive={executive} managerial={managerial} operational={operational} analytical={analytical} />
    </div>
  );
}
