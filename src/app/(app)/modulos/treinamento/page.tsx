import { resolveScopedFilters } from "@/lib/scope";
import { BookOpen, Wallet, Star, AlertTriangle } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { ModuleViewTabs } from "@/components/dashboard/module-view-tabs";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RankingBarChart } from "@/components/dashboard/ranking-bar-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatCurrency, formatDate } from "@/lib/utils";
import { getTreinamentoKpis, getTrainingByTitle, getTrainingTable } from "@/services/treinamento";

export default async function TreinamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ unidade?: string; periodo?: string }>;
}) {
  const params = await searchParams;
  const filters = await resolveScopedFilters(params);

  const [kpis, byTitle, table] = await Promise.all([
    getTreinamentoKpis(filters),
    getTrainingByTitle(filters),
    getTrainingTable(filters),
  ]);

  const executive = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Horas de treinamento" value={`${formatNumber(kpis.totalHours)} h`} icon={BookOpen} accent="navy" />
        <KpiCard label="Custo total" value={formatCurrency(kpis.totalCost)} icon={Wallet} accent="gold" />
        <KpiCard label="Eficácia média" value={kpis.avgEffectiveness.toFixed(1)} icon={Star} accent="success" />
        <KpiCard label="Vencendo em 30 dias" value={formatNumber(kpis.expiringSoon)} icon={AlertTriangle} accent="danger" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Horas por treinamento</CardTitle>
        </CardHeader>
        <CardContent>
          {byTitle.length > 0 ? <RankingBarChart data={byTitle} /> : <p className="text-sm text-muted-foreground">Sem treinamentos no período.</p>}
        </CardContent>
      </Card>
    </div>
  );

  const managerial = (
    <Card>
      <CardHeader>
        <CardTitle>Distribuição de horas por treinamento</CardTitle>
      </CardHeader>
      <CardContent>
        {byTitle.length > 0 ? <RankingBarChart data={byTitle} color="#B8935A" /> : <p className="text-sm text-muted-foreground">Sem dados.</p>}
      </CardContent>
    </Card>
  );

  const operational = (
    <Card>
      <CardHeader>
        <CardTitle>Treinamentos realizados</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Treinamento</TableHead>
              <TableHead>Horas</TableHead>
              <TableHead>Conclusão</TableHead>
              <TableHead>Obrigatório</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.employee.name}</TableCell>
                <TableCell>{t.employee.unit.name}</TableCell>
                <TableCell>{t.title}</TableCell>
                <TableCell>{t.hours} h</TableCell>
                <TableCell>{t.completedAt ? formatDate(t.completedAt) : "—"}</TableCell>
                <TableCell>{t.isMandatory ? <Badge variant="warning">Sim</Badge> : <Badge variant="outline">Não</Badge>}</TableCell>
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
        <CardTitle>Indicadores analíticos</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="Horas por colaborador" value={`${kpis.hoursPerEmployee.toFixed(1)} h`} icon={BookOpen} accent="navy" />
        <KpiCard label="ROI (eficácia/custo)" value={kpis.totalCost > 0 ? (kpis.avgEffectiveness / (kpis.totalCost / 1000)).toFixed(2) : "—"} icon={Star} accent="success" />
        <KpiCard label="Registros no período" value={formatNumber(kpis.totalRecords)} icon={BookOpen} accent="gold" />
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader title="Treinamento & Desenvolvimento" description="Horas, custos, eficácia e obrigatoriedade legal dos treinamentos." moduleKey="treinamento" />
      <ModuleViewTabs executive={executive} managerial={managerial} operational={operational} analytical={analytical} />
    </div>
  );
}
