import { resolveScopedFilters } from "@/lib/scope";
import { ScanFace, Clock3, AlertOctagon, ListChecks } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { ModuleViewTabs } from "@/components/dashboard/module-view-tabs";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RankingBarChart } from "@/components/dashboard/ranking-bar-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import { TurnstileImportDialog } from "@/components/admin/turnstile-import-dialog";
import { prisma } from "@/lib/prisma";
import { getCatracaKpis, getCatracaRanking, getCatracaByUnit, getCatracaTable } from "@/services/catraca";

export default async function CatracaPage({
  searchParams,
}: {
  searchParams: Promise<{ unidade?: string; periodo?: string }>;
}) {
  const params = await searchParams;
  const filters = await resolveScopedFilters(params);

  const [kpis, ranking, byUnit, table, employees] = await Promise.all([
    getCatracaKpis(filters),
    getCatracaRanking(filters),
    getCatracaByUnit(filters),
    getCatracaTable(filters),
    prisma.employee.findMany({ select: { id: true, registration: true } }),
  ]);

  const registrationToId = Object.fromEntries(employees.map((e) => [e.registration, e.id]));

  const executive = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Tempo total fora do posto" value={`${kpis.totalHours.toFixed(0)} h`} icon={Clock3} accent="gold" />
        <KpiCard label="Ocorrências" value={formatNumber(kpis.totalOccurrences)} icon={ListChecks} accent="navy" />
        <KpiCard label="Média por colaborador" value={`${kpis.avgMinutesPerEmployee.toFixed(0)} min`} icon={ScanFace} accent="gold" />
        <KpiCard label="Colaboradores críticos" value={formatNumber(kpis.criticalEmployees)} icon={AlertOctagon} accent="danger" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Tempo fora do posto por unidade (minutos)</CardTitle>
        </CardHeader>
        <CardContent>
          {byUnit.length > 0 ? <RankingBarChart data={byUnit} color="#B8935A" /> : <p className="text-sm text-muted-foreground">Sem ocorrências no período.</p>}
        </CardContent>
      </Card>
    </div>
  );

  const managerial = (
    <Card>
      <CardHeader>
        <CardTitle>Ranking de colaboradores (minutos fora do posto)</CardTitle>
      </CardHeader>
      <CardContent>
        {ranking.length > 0 ? <RankingBarChart data={ranking} color="#B23A48" /> : <p className="text-sm text-muted-foreground">Sem ocorrências no período.</p>}
      </CardContent>
    </Card>
  );

  const operational = (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Detalhamento por colaborador</CardTitle>
        <TurnstileImportDialog registrationToId={registrationToId} />
      </CardHeader>
      <CardContent>
        {table.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum registro de catraca ainda. Clique em &quot;Importar relatório de catraca&quot; para subir o arquivo.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Ocorrências</TableHead>
                <TableHead>Minutos fora do posto</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.map((d) => (
                <TableRow key={d.employeeId}>
                  <TableCell>{d.name}</TableCell>
                  <TableCell>{d.unit}</TableCell>
                  <TableCell>{d.occurrences}</TableCell>
                  <TableCell>{d.minutesOut} min</TableCell>
                  <TableCell>
                    {d.minutesOut > 120 ? <Badge variant="danger">Crítico</Badge> : <Badge variant="outline">Normal</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  const analytical = (
    <Card>
      <CardHeader>
        <CardTitle>Indicadores analíticos</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="Tempo total" value={`${kpis.totalHours.toFixed(0)} h`} icon={Clock3} accent="gold" />
        <KpiCard label="Colaboradores críticos" value={formatNumber(kpis.criticalEmployees)} icon={AlertOctagon} accent="danger" />
        <KpiCard label="Média por colaborador" value={`${kpis.avgMinutesPerEmployee.toFixed(0)} min`} icon={ScanFace} accent="navy" />
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader title="Catraca e Permanência Fora do Posto" description="Monitoramento do tempo fora do posto de trabalho a partir dos dados de catraca." moduleKey="catraca" />
      <ModuleViewTabs executive={executive} managerial={managerial} operational={operational} analytical={analytical} />
    </div>
  );
}
