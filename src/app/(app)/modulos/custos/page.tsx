import { resolveScopedFilters } from "@/lib/scope";
import { Wallet, TrendingUp, Percent, Users } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { ModuleViewTabs } from "@/components/dashboard/module-view-tabs";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { RankingBarChart } from "@/components/dashboard/ranking-bar-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { lastNMonthsKeys, monthLabelsPtBR } from "@/services/period";
import { getCustosKpis, getCostTrend, getCostByCostCenter, getAverageSalaryByPosition } from "@/services/custos";

export default async function CustosPage({
  searchParams,
}: {
  searchParams: Promise<{ unidade?: string; periodo?: string }>;
}) {
  const params = await searchParams;
  const filters = await resolveScopedFilters(params);

  const [kpis, trend, byCostCenter, avgSalaryByPosition] = await Promise.all([
    getCustosKpis(filters),
    getCostTrend(filters),
    getCostByCostCenter(filters),
    getAverageSalaryByPosition(filters),
  ]);

  const monthLabels = monthLabelsPtBR(lastNMonthsKeys(12));

  const executive = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Folha salarial total" value={formatCurrency(kpis.totalCost)} icon={Wallet} accent="navy" />
        <KpiCard label="Custo / Receita" value={kpis.costToRevenueRatio ? formatPercent(kpis.costToRevenueRatio) : "sem receita"} icon={Percent} accent="gold" />
        <KpiCard label="Custo por headcount" value={formatCurrency(kpis.costPerHeadcount)} icon={Users} accent="gold" />
        <KpiCard label="Receita no período" value={formatCurrency(kpis.totalRevenue)} icon={TrendingUp} accent="success" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Custo de pessoal — 12 meses</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart data={trend} labels={monthLabels} color="#1B2A4A" valueFormatter={(v) => formatCurrency(v)} />
        </CardContent>
      </Card>
    </div>
  );

  const managerial = (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Custo por centro de custo</CardTitle>
        </CardHeader>
        <CardContent>
          {byCostCenter.length > 0 ? <RankingBarChart data={byCostCenter} /> : <p className="text-sm text-muted-foreground">Sem dados.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Salário médio por cargo</CardTitle>
        </CardHeader>
        <CardContent>
          {avgSalaryByPosition.length > 0 ? <RankingBarChart data={avgSalaryByPosition} color="#B8935A" /> : <p className="text-sm text-muted-foreground">Sem dados.</p>}
        </CardContent>
      </Card>
    </div>
  );

  const operational = (
    <Card>
      <CardHeader>
        <CardTitle>Composição do custo de pessoal</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="Salário base" value={formatCurrency(kpis.baseSalaryTotal)} icon={Wallet} accent="navy" />
        <KpiCard label="Benefícios" value={formatCurrency(kpis.benefitsCost)} icon={Wallet} accent="gold" />
        <KpiCard label="Encargos" value={formatCurrency(kpis.chargesCost)} icon={Wallet} accent="danger" />
      </CardContent>
    </Card>
  );

  const analytical = (
    <Card>
      <CardHeader>
        <CardTitle>Indicadores analíticos</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="Custo / Receita" value={kpis.costToRevenueRatio ? formatPercent(kpis.costToRevenueRatio) : "—"} icon={Percent} accent="gold" />
        <KpiCard label="Custo por headcount" value={formatCurrency(kpis.costPerHeadcount)} icon={Users} accent="navy" />
        <KpiCard label="Folha total" value={formatCurrency(kpis.totalCost)} icon={Wallet} accent="danger" />
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader title="Custos de Pessoal" description="Folha, encargos, benefícios e relação custo x receita." moduleKey="custos" />
      <ModuleViewTabs executive={executive} managerial={managerial} operational={operational} analytical={analytical} />
    </div>
  );
}
