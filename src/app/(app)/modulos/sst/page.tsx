import { resolveScopedFilters } from "@/lib/scope";
import { ShieldAlert, FileWarning, Gauge, Clock3 } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { ModuleViewTabs } from "@/components/dashboard/module-view-tabs";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RankingBarChart } from "@/components/dashboard/ranking-bar-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatDate } from "@/lib/utils";
import { getSstKpis, getIncidentsTable, getIncidentsByType } from "@/services/sst";

export default async function SstPage({
  searchParams,
}: {
  searchParams: Promise<{ unidade?: string; periodo?: string }>;
}) {
  const params = await searchParams;
  const filters = await resolveScopedFilters(params);

  const [kpis, byType, table] = await Promise.all([
    getSstKpis(filters),
    getIncidentsByType(filters),
    getIncidentsTable(filters),
  ]);

  const executive = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Acidentes no período" value={formatNumber(kpis.accidentsCount)} icon={ShieldAlert} accent="danger" />
        <KpiCard label="Near miss reportados" value={formatNumber(kpis.nearMissesCount)} icon={FileWarning} accent="gold" />
        <KpiCard label="Taxa de frequência" value={kpis.frequencyRate.toFixed(2)} icon={Gauge} accent="navy" />
        <KpiCard label="Taxa de gravidade" value={kpis.severityRate.toFixed(2)} icon={Clock3} accent="danger" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Ocorrências por tipo</CardTitle>
        </CardHeader>
        <CardContent>
          {byType.length > 0 ? <RankingBarChart data={byType} /> : <p className="text-sm text-muted-foreground">Sem ocorrências no período.</p>}
        </CardContent>
      </Card>
    </div>
  );

  const managerial = (
    <Card>
      <CardHeader>
        <CardTitle>Distribuição de ocorrências</CardTitle>
      </CardHeader>
      <CardContent>
        {byType.length > 0 ? <RankingBarChart data={byType} color="#B23A48" /> : <p className="text-sm text-muted-foreground">Sem dados.</p>}
      </CardContent>
    </Card>
  );

  const operational = (
    <Card>
      <CardHeader>
        <CardTitle>Ocorrências registradas</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>CAT</TableHead>
              <TableHead>Dias perdidos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.map((i) => (
              <TableRow key={i.id}>
                <TableCell>{i.employee?.name ?? "—"}</TableCell>
                <TableCell>{i.employee?.unit.name ?? "—"}</TableCell>
                <TableCell>{formatDate(i.date)}</TableCell>
                <TableCell>
                  <Badge variant={i.type === "ACIDENTE" ? "danger" : "outline"}>{i.type === "ACIDENTE" ? "Acidente" : "Near Miss"}</Badge>
                </TableCell>
                <TableCell>{i.hasCAT ? <Badge variant="warning">Sim</Badge> : "—"}</TableCell>
                <TableCell>{i.daysLost}</TableCell>
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
        <CardTitle>Indicadores legais</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="Taxa de frequência" value={kpis.frequencyRate.toFixed(2)} icon={Gauge} accent="navy" />
        <KpiCard label="Taxa de gravidade" value={kpis.severityRate.toFixed(2)} icon={Clock3} accent="danger" />
        <KpiCard label="CAT emitidas" value={formatNumber(kpis.withCAT)} icon={FileWarning} accent="gold" />
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader title="Saúde e Segurança do Trabalho" description="Acidentes, CAT, near miss e taxas legais de frequência e gravidade." moduleKey="sst" />
      <ModuleViewTabs executive={executive} managerial={managerial} operational={operational} analytical={analytical} />
    </div>
  );
}
