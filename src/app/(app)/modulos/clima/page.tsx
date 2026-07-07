import { resolveScopedFilters } from "@/lib/scope";
import { Heart, Smile, MessageSquare } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { ModuleViewTabs } from "@/components/dashboard/module-view-tabs";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RankingBarChart } from "@/components/dashboard/ranking-bar-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPercent, formatNumber } from "@/lib/utils";
import { getClimaKpis, getFavorabilityByDimension, getFavorabilityByArea } from "@/services/clima";

export default async function ClimaPage({
  searchParams,
}: {
  searchParams: Promise<{ unidade?: string; periodo?: string }>;
}) {
  const params = await searchParams;
  const filters = await resolveScopedFilters(params);

  const [kpis, byDimension, byArea] = await Promise.all([
    getClimaKpis(filters),
    getFavorabilityByDimension(filters),
    getFavorabilityByArea(filters),
  ]);

  const executive = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <KpiCard label="Favorabilidade geral" value={formatPercent(kpis.favorability)} icon={Smile} accent="success" />
        <KpiCard label="eNPS" value={kpis.enps.toFixed(0)} icon={Heart} accent="gold" />
        <KpiCard label="Respostas coletadas" value={formatNumber(kpis.totalResponses)} icon={MessageSquare} accent="navy" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Favorabilidade por dimensão — {kpis.cycle} (%)</CardTitle>
        </CardHeader>
        <CardContent>
          {byDimension.length > 0 ? <RankingBarChart data={byDimension} /> : <p className="text-sm text-muted-foreground">Sem dados do ciclo.</p>}
        </CardContent>
      </Card>
    </div>
  );

  const managerial = (
    <Card>
      <CardHeader>
        <CardTitle>Favorabilidade por área (%)</CardTitle>
      </CardHeader>
      <CardContent>
        {byArea.length > 0 ? <RankingBarChart data={byArea} color="#B8935A" /> : <p className="text-sm text-muted-foreground">Sem dados.</p>}
      </CardContent>
    </Card>
  );

  const operational = (
    <Card>
      <CardHeader>
        <CardTitle>Favorabilidade por dimensão — detalhado</CardTitle>
      </CardHeader>
      <CardContent>
        {byDimension.length > 0 ? <RankingBarChart data={byDimension} color="#4C8B5B" /> : <p className="text-sm text-muted-foreground">Sem dados.</p>}
      </CardContent>
    </Card>
  );

  const analytical = (
    <Card>
      <CardHeader>
        <CardTitle>Indicadores analíticos</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="Favorabilidade" value={formatPercent(kpis.favorability)} icon={Smile} accent="success" />
        <KpiCard label="eNPS" value={kpis.enps.toFixed(0)} icon={Heart} accent="gold" />
        <KpiCard label="Ciclo atual" value={kpis.cycle} icon={MessageSquare} accent="navy" />
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader title="Clima Organizacional / eNPS" description="Favorabilidade, engajamento e recomendação da empresa como lugar para trabalhar." moduleKey="clima" />
      <ModuleViewTabs executive={executive} managerial={managerial} operational={operational} analytical={analytical} />
    </div>
  );
}
