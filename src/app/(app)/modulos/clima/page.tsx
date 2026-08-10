import { resolveScopedFilters } from "@/lib/scope";
import { Heart, Smile, MessageSquare } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { ModuleViewTabs } from "@/components/dashboard/module-view-tabs";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RankingBarChart } from "@/components/dashboard/ranking-bar-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPercent, formatNumber } from "@/lib/utils";
import { SurveyImportDialog } from "@/components/admin/survey-import-dialog";
import { CycleComparisonTable } from "@/components/dashboard/cycle-comparison-table";
import { getClimaKpis, getFavorabilityByDimension, getFavorabilityByArea, getCycleComparison } from "@/services/clima";

export default async function ClimaPage({
  searchParams,
}: {
  searchParams: Promise<{ unidade?: string; periodo?: string }>;
}) {
  const params = await searchParams;
  const filters = await resolveScopedFilters(params);

  const [kpis, byDimension, byArea, comparison] = await Promise.all([
    getClimaKpis(filters),
    getFavorabilityByDimension(filters),
    getFavorabilityByArea(filters),
    getCycleComparison(),
  ]);

  const executive = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <KpiCard label="Favorabilidade geral" value={formatPercent(kpis.favorability)} icon={Smile} accent="success" tooltip={"Percentual de respostas com nota 7 ou mais (em escala de 0 a 10), somando todas as dimensões da pesquisa de clima do ciclo atual (PCO 2026)."} />
        <KpiCard label="eNPS" value={kpis.enps.toFixed(0)} icon={Heart} accent="gold" tooltip={"Calculado só com as respostas da pergunta Recomendaria a Empresa: nota 9-10 conta como promotor, 0-6 como detrator. Fórmula: ((promotores - detratores) / total de respostas dessa pergunta) x 100."} />
        <KpiCard
          label="Respondentes"
          value={kpis.totalInvited ? formatNumber(kpis.totalRespondents) + " (" + formatPercent(kpis.participationRate ?? 0) + ")" : formatNumber(kpis.totalRespondents)}
          icon={MessageSquare}
          accent="navy"
        tooltip={"Total de pessoas que responderam a pesquisa de clima no ciclo atual. Quando o total de convidados está cadastrado, mostra também a taxa de participação (respondentes / convidados)."}
      />
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
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="Favorabilidade" value={formatPercent(kpis.favorability)} icon={Smile} accent="success" tooltip={"Percentual de respostas com nota 7 ou mais (em escala de 0 a 10), somando todas as dimensões da pesquisa de clima do ciclo atual."} />
        <KpiCard label="eNPS" value={kpis.enps.toFixed(0)} icon={Heart} accent="gold" tooltip={"Calculado só com as respostas da pergunta Recomendaria a Empresa: nota 9-10 conta como promotor, 0-6 como detrator. Fórmula: ((promotores - detratores) / total de respostas dessa pergunta) x 100."} />
        <KpiCard label="Ciclo atual" value={kpis.cycle} icon={MessageSquare} accent="navy" tooltip={"Nome do ciclo de pesquisa de clima em vigor no momento (ex.: PCO 2026)."} />
      </div>
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Comparação entre ciclos</CardTitle>
          <SurveyImportDialog />
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <CycleComparisonTable data={comparison} />
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader title="Clima Organizacional / eNPS" description="Favorabilidade, engajamento e recomendação da empresa como lugar para trabalhar." moduleKey="clima" />
      <ModuleViewTabs executive={executive} managerial={managerial} operational={operational} analytical={analytical} />
    </div>
  );
}
