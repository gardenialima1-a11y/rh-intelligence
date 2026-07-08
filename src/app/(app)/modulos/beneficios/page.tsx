import { resolveScopedFilters } from "@/lib/scope";
import { Gift, Wallet, Users } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { ModuleViewTabs } from "@/components/dashboard/module-view-tabs";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { RankingBarChart } from "@/components/dashboard/ranking-bar-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatNumber } from "@/lib/utils";
import { lastNMonthsKeys, monthLabelsPtBR } from "@/services/period";
import { getBeneficiosKpis, getBenefitsCostTrend, getBenefitsCostByCostCenter } from "@/services/beneficios";

export default async function BeneficiosPage({
  searchParams,
}: {
  searchParams: Promise<{ unidade?: string; periodo?: string }>;
}) {
  const params = await searchParams;
  const filters = await resolveScopedFilters(params);

  const [kpis, trend, byCostCenter] = await Promise.all([
    getBeneficiosKpis(filters),
    getBenefitsCostTrend(filters),
    getBenefitsCostByCostCenter(filters),
  ]);

  const monthLabels = monthLabelsPtBR(lastNMonthsKeys(12));

  const executive = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <KpiCard label="Custo total de benefícios" value={formatCurrency(kpis.totalCost)} icon={Gift} accent="navy" />
        <KpiCard label="Custo por colaborador" value={formatCurrency(kpis.avgCostPerEmployee)} icon={Wallet} accent="gold" />
        <KpiCard label="Colaboradores ativos" value={formatNumber(kpis.headcount)} icon={Users} accent="success" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Custo de benefícios — 12 meses</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart data={trend} labels={monthLabels} color="#B8935A" format="currency" />
        </CardContent>
      </Card>
    </div>
  );

  const managerial = (
    <Card>
      <CardHeader>
        <CardTitle>Custo de benefícios por centro de custo</CardTitle>
      </CardHeader>
      <CardContent>
        {byCostCenter.length > 0 ? <RankingBarChart data={byCostCenter} /> : <p className="text-sm text-muted-foreground">Sem dados.</p>}
      </CardContent>
    </Card>
  );

  const operational = (
    <Card>
      <CardHeader>
        <CardTitle>Resumo de utilização</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Detalhamento por tipo de benefício (plano de saúde, vale-alimentação, vale-refeição, benefícios flexíveis)
          depende da integração com a operadora de benefícios — pronta para conexão via arquivo CSV ou API na camada de ingestão.
        </p>
      </CardContent>
    </Card>
  );

  const analytical = (
    <Card>
      <CardHeader>
        <CardTitle>Indicadores analíticos</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="Custo total" value={formatCurrency(kpis.totalCost)} icon={Gift} accent="navy" />
        <KpiCard label="Custo médio" value={formatCurrency(kpis.avgCostPerEmployee)} icon={Wallet} accent="gold" />
        <KpiCard label="Base de colaboradores" value={formatNumber(kpis.headcount)} icon={Users} accent="success" />
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader title="Benefícios" description="Custo e utilização dos benefícios oferecidos aos colaboradores." moduleKey="beneficios" />
      <ModuleViewTabs executive={executive} managerial={managerial} operational={operational} analytical={analytical} />
    </div>
  );
}
