import { resolveScopedFilters } from "@/lib/scope";
import { Trophy, Users, UserX, Sparkles, ArrowUpRight, Repeat } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { ModuleViewTabs } from "@/components/dashboard/module-view-tabs";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RankingBarChart } from "@/components/dashboard/ranking-bar-chart";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatPercent } from "@/lib/utils";
import { lastNMonthsKeys, monthLabelsPtBR } from "@/services/period";
import { getLiderancaKpis, getSpanOfControlRanking, getSuccessionTable, getInternalMobilityKpis, getMobilityTrend } from "@/services/lideranca";
import { getManagersFlat } from "@/services/organograma";
import { DeleteManagerButton } from "@/components/admin/delete-manager-button";
import { MergeManagerButton } from "@/components/admin/merge-manager-dialog";

export default async function LiderancaPage({
  searchParams,
}: {
  searchParams: Promise<{ unidade?: string; periodo?: string }>;
}) {
  const params = await searchParams;
  const filters = await resolveScopedFilters(params);

  const [kpis, ranking, succession, mobility, mobilityTrend, allManagers] = await Promise.all([
    getLiderancaKpis(filters),
    getSpanOfControlRanking(filters),
    getSuccessionTable(filters),
    getInternalMobilityKpis(filters),
    getMobilityTrend(filters),
    getManagersFlat(),
  ]);

  const monthLabels = monthLabelsPtBR(lastNMonthsKeys(12));

  const executive = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Total de gestores" value={formatNumber(kpis.totalManagers)} icon={Trophy} accent="navy" />
        <KpiCard label="Span of control médio" value={kpis.avgSpanOfControl.toFixed(1)} icon={Users} accent="gold" />
        <KpiCard label="Desligamentos de liderança" value={formatNumber(kpis.managerTerminations)} icon={UserX} accent="danger" />
        <KpiCard label="Alto potencial identificado" value={formatNumber(kpis.highPotential)} icon={Sparkles} accent="success" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Span of control por gestor</CardTitle>
        </CardHeader>
        <CardContent>
          {ranking.length > 0 ? <RankingBarChart data={ranking} /> : <p className="text-sm text-muted-foreground">Sem dados.</p>}
        </CardContent>
      </Card>
    </div>
  );

  const managerial = (
    <Card>
      <CardHeader>
        <CardTitle>Ranking completo de span of control</CardTitle>
      </CardHeader>
      <CardContent>
        {ranking.length > 0 ? <RankingBarChart data={ranking} color="#B8935A" /> : <p className="text-sm text-muted-foreground">Sem dados.</p>}
      </CardContent>
    </Card>
  );

  const operational = (
    <Card>
      <CardHeader>
        <CardTitle>Plano de sucessão — posições cobertas</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Gestor</TableHead>
              <TableHead>Área</TableHead>
              <TableHead>Equipe ativa</TableHead>
              <TableHead>Sucessores potenciais</TableHead>
              <TableHead className="w-24">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {succession.map((m) => {
              const potentialSuccessors = m.employees.filter((e) =>
                e.reviews[0]?.boxLabel?.includes("Alto Potencial")
              ).length;
              return (
                <TableRow key={m.id}>
                  <TableCell>{m.name}</TableCell>
                  <TableCell>{m.area}</TableCell>
                  <TableCell>{m.employees.length}</TableCell>
                  <TableCell>
                    {potentialSuccessors > 0 ? (
                      <Badge variant="success">{potentialSuccessors} identificado(s)</Badge>
                    ) : (
                      <Badge variant="danger">Nenhum</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      <MergeManagerButton manager={{ id: m.id, name: m.name, area: m.area }} allManagers={allManagers} />
                      <DeleteManagerButton managerId={m.id} managerName={m.name} />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  const analytical = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="Taxa de mobilidade interna" value={formatPercent(mobility.mobilityRate)} icon={Repeat} accent="success" />
        <KpiCard label="Promoções no período" value={formatNumber(mobility.promotions)} icon={ArrowUpRight} accent="gold" />
        <KpiCard label="Transferências no período" value={formatNumber(mobility.transfers)} icon={Users} accent="navy" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Mobilidade interna — 12 meses (promoções + transferências)</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart data={mobilityTrend} labels={monthLabels} color="#4C8B5B" />
          <p className="mt-2 text-xs text-muted-foreground">
            Mercados de referência associam mobilidade interna saudável a menor turnover voluntário e maior
            engajamento — recomenda-se acompanhar a tendência junto com o índice de alto potencial.
          </p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader title="Liderança e Gestão" description="Índice de liderança, span of control e plano de sucessão." moduleKey="lideranca" />
      <ModuleViewTabs executive={executive} managerial={managerial} operational={operational} analytical={analytical} />
    </div>
  );
}
