import { resolveScopedFilters } from "@/lib/scope";
import { DoorOpen, TrendingUp, ShieldCheck, Users2 } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { ModuleViewTabs } from "@/components/dashboard/module-view-tabs";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { RankingBarChart } from "@/components/dashboard/ranking-bar-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatPercent, formatDate } from "@/lib/utils";
import { lastNMonthsKeys, monthLabelsPtBR } from "@/services/period";
import { TableCardHeader } from "@/components/dashboard/table-card-header";
import { getAdmissoesKpis, getAdmissoesByUnit, getAdmissoesByPosition, getAdmissoesTable } from "@/services/admissoes";

export default async function AdmissoesPage({
  searchParams,
}: {
  searchParams: Promise<{ unidade?: string; periodo?: string }>;
}) {
  const params = await searchParams;
  const filters = await resolveScopedFilters(params);

  const [kpis, byUnit, byPosition, table] = await Promise.all([
    getAdmissoesKpis(filters),
    getAdmissoesByUnit(filters),
    getAdmissoesByPosition(filters),
    getAdmissoesTable(filters),
  ]);

  const monthLabels = monthLabelsPtBR(lastNMonthsKeys(12));

  const executive = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Admissões no período" value={formatNumber(kpis.current)} icon={DoorOpen} deltaLabel={formatPercent(Math.abs(kpis.delta))} deltaDirection={kpis.delta >= 0 ? "up" : "down"} deltaSentiment="neutral" sparklineData={kpis.series} accent="navy" />
        <KpiCard label="Qualidade de contratação" value={formatPercent(kpis.qualityRate)} icon={ShieldCheck} accent="success" />
        <KpiCard label="Total admitidos (base)" value={formatNumber(kpis.totalAdmitted)} icon={Users2} accent="gold" />
        <KpiCard label="Tendência" value={formatNumber(kpis.current)} icon={TrendingUp} accent="navy" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Admissões — 12 meses</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart data={kpis.series} labels={monthLabels} color="#4C8B5B" />
        </CardContent>
      </Card>
    </div>
  );

  const managerial = (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Admissões por unidade</CardTitle>
        </CardHeader>
        <CardContent>
          {byUnit.length > 0 ? <RankingBarChart data={byUnit} /> : <p className="text-sm text-muted-foreground">Sem admissões no período.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Admissões por cargo</CardTitle>
        </CardHeader>
        <CardContent>
          {byPosition.length > 0 ? <RankingBarChart data={byPosition} color="#B8935A" /> : <p className="text-sm text-muted-foreground">Sem admissões no período.</p>}
        </CardContent>
      </Card>
    </div>
  );

  const operational = (
    <Card>
      <TableCardHeader
        title="Admissões no período"
        filename="admissoes"
        data={table.map((e) => ({
          matricula: e.registration,
          nome: e.name,
          cargo: e.position?.name ?? "",
          gestor: e.manager?.name ?? "",
          unidade: e.unit.name,
          admissao: e.admissionDate,
          contrato: e.contractType,
          status: e.isActive ? "Ativo" : "Desligado",
        }))}
        columns={[
          { key: "matricula", label: "Matrícula" },
          { key: "nome", label: "Nome" },
          { key: "cargo", label: "Cargo" },
          { key: "gestor", label: "Gestor" },
          { key: "unidade", label: "Unidade" },
          { key: "admissao", label: "Admissão" },
          { key: "contrato", label: "Contrato" },
          { key: "status", label: "Status" },
        ]}
      />
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Matrícula</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Gestor</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Admissão</TableHead>
              <TableHead>Contrato</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{e.registration}</TableCell>
                <TableCell>{e.name}</TableCell>
                <TableCell>{e.position?.name ?? "—"}</TableCell>
                <TableCell>{e.manager?.name ?? "—"}</TableCell>
                <TableCell>{e.unit.name}</TableCell>
                <TableCell>{formatDate(e.admissionDate)}</TableCell>
                <TableCell>
                  <Badge variant="outline">{e.contractType}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={e.isActive ? "success" : "danger"}>{e.isActive ? "Ativo" : "Desligado"}</Badge>
                </TableCell>
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
        <CardTitle>Indicadores de qualidade de contratação</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="Qualidade (sem saída em 90d)" value={formatPercent(kpis.qualityRate)} icon={ShieldCheck} accent="success" />
        <KpiCard label="Base analisada" value={formatNumber(kpis.totalAdmitted)} icon={Users2} accent="navy" />
        <KpiCard label="Admissões no período" value={formatNumber(kpis.current)} icon={DoorOpen} accent="gold" />
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader title="Admissões" description="Volume, distribuição e qualidade das contratações realizadas." moduleKey="admissoes" />
      <ModuleViewTabs executive={executive} managerial={managerial} operational={operational} analytical={analytical} />
    </div>
  );
}
