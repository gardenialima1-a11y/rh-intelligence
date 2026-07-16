import { resolveScopedFilters } from "@/lib/scope";
import { Wallet, TrendingUp, Percent, Users, Scale, ArrowDownRight } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { ModuleViewTabs } from "@/components/dashboard/module-view-tabs";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { RankingBarChart } from "@/components/dashboard/ranking-bar-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddBenchmarkDialog } from "@/components/admin/add-benchmark-dialog";
import { BenchmarkTable } from "@/components/admin/benchmark-table";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { lastNMonthsKeys, monthLabelsPtBR } from "@/services/period";
import { getCustosKpis, getCostTrend, getCostByCostCenter, getAverageSalaryByPosition } from "@/services/custos";
import { getSalaryBenchmarkComparison, getBenchmarkSummary } from "@/services/salary-benchmark";
import { getPositionsWithoutBenchmark } from "@/actions/salary-benchmark";

export default async function CustosPage({
  searchParams,
}: {
  searchParams: Promise<{ unidade?: string; periodo?: string }>;
}) {
  const params = await searchParams;
  const filters = await resolveScopedFilters(params);

  const [kpis, trend, byCostCenter, avgSalaryByPosition, benchmarkRows, benchmarkSummary, positionsWithoutBenchmark] = await Promise.all([
    getCustosKpis(filters),
    getCostTrend(filters),
    getCostByCostCenter(filters),
    getAverageSalaryByPosition(filters),
    getSalaryBenchmarkComparison(),
    getBenchmarkSummary(),
    getPositionsWithoutBenchmark(),
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
          <TrendChart data={trend} labels={monthLabels} color="#1B2A4A" format="currency" />
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
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Custo / Receita" value={kpis.costToRevenueRatio ? formatPercent(kpis.costToRevenueRatio) : "—"} icon={Percent} accent="gold" />
        <KpiCard label="Custo por headcount" value={formatCurrency(kpis.costPerHeadcount)} icon={Users} accent="navy" />
        <KpiCard
          label="Cargos abaixo do mercado"
          value={String(benchmarkSummary.positionsBelowMarket)}
          icon={ArrowDownRight}
          accent={benchmarkSummary.positionsBelowMarket > 0 ? "danger" : "success"}
        />
        <KpiCard
          label="Gap médio vs. mercado"
          value={benchmarkSummary.positionsComparable > 0 ? formatPercent(benchmarkSummary.avgGapPercent / 100) : "sem dados"}
          icon={Scale}
          accent="gold"
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Benchmarking Salarial — {benchmarkRows[0]?.marketAvgSalary ? "Fortaleza, CE" : "cadastre a referência de mercado"}</CardTitle>
          <AddBenchmarkDialog positions={positionsWithoutBenchmark} />
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">
            Comparação entre o salário médio pago pela empresa e uma referência de mercado pesquisada manualmente
            (não é uma integração em tempo real). Clique em &quot;Editar&quot; para atualizar qualquer valor sempre que
            tiver uma pesquisa mais recente (Catho, Mercer, Robert Half, Glassdoor, Indeed...).
          </p>
          {benchmarkRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum cargo com dados suficientes ainda.</p>
          ) : (
            <BenchmarkTable rows={benchmarkRows} />
          )}
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader title="Custos de Pessoal" description="Folha, encargos, benefícios e relação custo x receita." moduleKey="custos" />
      <ModuleViewTabs executive={executive} managerial={managerial} operational={operational} analytical={analytical} />
    </div>
  );
}
