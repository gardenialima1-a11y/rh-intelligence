import { resolveScopedFilters } from "@/lib/scope";
import { Users, TrendingUp, AlertTriangle, Heart, Target, Wallet, LineChart, ShieldAlert } from "lucide-react";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { NarrativeCard } from "@/components/dashboard/narrative-card";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { BarByUnitChart } from "@/components/dashboard/bar-by-unit-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPercent, formatNumber, formatCurrency } from "@/lib/utils";
import { lastNMonthsKeys, monthLabelsPtBR } from "@/services/period";
import { getFlightRiskSummary } from "@/services/people-analytics";
import {
  getExecutiveNarrative,
  getActiveAlerts,
  getHeadcountByUnit,
  getPeopleCostKpi,
  getHumanCapitalEfficiency,
} from "@/services/dashboard-executivo";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ unidade?: string; periodo?: string }>;
}) {
  const params = await searchParams;
  const filters = await resolveScopedFilters(params);

  const [narrative, alerts, headcountByUnit, cost, hcEfficiency, flightRisk] = await Promise.all([
    getExecutiveNarrative(filters),
    getActiveAlerts(),
    getHeadcountByUnit(),
    getPeopleCostKpi(filters),
    getHumanCapitalEfficiency(filters),
    getFlightRiskSummary(filters),
  ]);

  const monthLabels = monthLabelsPtBR(lastNMonthsKeys(12));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-navy dark:text-cream">Dashboard Executivo</h1>
        <p className="max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
          Visão consolidada da saúde de RH da organização — atualizado automaticamente.
        </p>
      </div>

      <NarrativeCard text={narrative.headline} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <KpiCard
          label="Headcount ativo"
          value={formatNumber(narrative.headcount.current)}
          icon={Users}
          deltaLabel={formatPercent(Math.abs(narrative.headcount.delta))}
          deltaDirection={narrative.headcount.delta >= 0 ? "up" : "down"}
          deltaSentiment={narrative.headcount.delta >= 0 ? "positive" : "negative"}
          sparklineData={narrative.headcount.series}
          accent="navy"
        />
        <KpiCard
          label="Turnover (período)"
          value={formatPercent(narrative.turnover.current)}
          icon={TrendingUp}
          deltaLabel={formatPercent(Math.abs(narrative.turnover.delta))}
          deltaDirection={narrative.turnover.delta >= 0 ? "up" : "down"}
          deltaSentiment={narrative.turnover.delta >= 0 ? "negative" : "positive"}
          sparklineData={narrative.turnover.series}
          accent="danger"
        />
        <KpiCard
          label="Absenteísmo"
          value={formatPercent(narrative.absenteeism.current)}
          icon={AlertTriangle}
          deltaLabel={formatPercent(Math.abs(narrative.absenteeism.delta))}
          deltaDirection={narrative.absenteeism.delta >= 0 ? "up" : "down"}
          deltaSentiment={narrative.absenteeism.delta >= 0 ? "negative" : "positive"}
          accent="gold"
        />
        <KpiCard
          label="eNPS"
          value={narrative.enps.current.toFixed(0)}
          icon={Heart}
          deltaLabel={narrative.enps.cycle ?? "sem ciclo"}
          deltaDirection="flat"
          accent="success"
        />
        <KpiCard
          label="Vagas em aberto"
          value={formatNumber(narrative.vacancies)}
          icon={Target}
          deltaDirection="flat"
          accent="gold"
          tooltip="Vagas com status Aberta ou Em andamento, contadas direto do cadastro de vagas do módulo de Recrutamento."
        />
        <KpiCard
          label="Custo de pessoal"
          value={formatCurrency(cost.totalCost)}
          icon={Wallet}
          deltaLabel={cost.ratio ? `${formatPercent(cost.ratio)} da receita` : "sem receita cadastrada"}
          deltaDirection="flat"
          accent="navy"
          tooltip="Soma dos lançamentos de folha (Salário Base + Benefícios + Encargos) de cada colaborador ativo no período selecionado. É gerado automaticamente ao cadastrar/importar um colaborador com salário informado."
        />
      </div>

      <div>
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Indicadores estratégicos de capital humano
        </p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KpiCard label="Receita por colaborador" value={formatCurrency(hcEfficiency.revenuePerEmployee)} icon={LineChart} accent="navy" />
          <KpiCard
            label="HCROI (aproximado)"
            value={hcEfficiency.hcroiApprox !== null ? hcEfficiency.hcroiApprox.toFixed(2) : "—"}
            icon={TrendingUp}
            accent={hcEfficiency.hcroiApprox !== null && hcEfficiency.hcroiApprox > 1 ? "success" : "gold"}
            tooltip="Human Capital ROI: quanto a empresa ganha em receita para cada R$1 investido em pessoal. Fórmula aproximada: (Receita - Custo de Pessoal) / Custo de Pessoal. Ex.: 1,00 significa que cada R$1 gasto com pessoal retornou R$1 de lucro além do próprio custo."
          />
          <KpiCard label="Colaboradores em risco alto" value={formatNumber(flightRisk.highRiskCount)} icon={ShieldAlert} accent="danger" />
          <KpiCard label="Sinalizados pelo Flight Risk" value={formatNumber(flightRisk.totalFlagged)} icon={AlertTriangle} accent="gold" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Headcount — últimos 12 meses</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart data={narrative.headcount.series} labels={monthLabels} color="#1B2A4A" />
          </CardContent>
        </Card>

        <AlertsPanel alerts={alerts} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Turnover — tendência (12 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <TrendChart
              data={narrative.turnover.series.map((v) => v * 100)}
              labels={monthLabels}
              color="#B23A48"
              format="percent1"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Headcount por unidade</CardTitle>
          </CardHeader>
          <CardContent>
            <BarByUnitChart data={headcountByUnit} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
