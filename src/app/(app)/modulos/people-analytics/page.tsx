import { resolveScopedFilters } from "@/lib/scope";
import { BrainCircuit, Sparkles, AlertTriangle, UserX, ShieldAlert, Users } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { ModuleViewTabs } from "@/components/dashboard/module-view-tabs";
import { RankingBarChart } from "@/components/dashboard/ranking-bar-chart";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { NarrativeCard } from "@/components/dashboard/narrative-card";
import { TableCardHeader } from "@/components/dashboard/table-card-header";
import { formatNumber } from "@/lib/utils";
import { getCorrelations, getRiskRankingByManager, getInsightsNarrative, getFlightRiskSummary } from "@/services/people-analytics";

const RISK_VARIANT: Record<string, "danger" | "warning" | "outline"> = {
  Alto: "danger",
  Médio: "warning",
  Baixo: "outline",
};

export default async function PeopleAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ unidade?: string; periodo?: string }>;
}) {
  const params = await searchParams;
  const filters = await resolveScopedFilters(params);

  const [correlations, riskRanking, insights, flightRisk] = await Promise.all([
    getCorrelations(filters),
    getRiskRankingByManager(filters),
    getInsightsNarrative(filters),
    getFlightRiskSummary(filters),
  ]);

  const executive = (
    <div className="flex flex-col gap-4">
      {insights.map((text, i) => (
        <NarrativeCard key={i} text={text} />
      ))}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <KpiCard label="Colaboradores em risco alto" value={formatNumber(flightRisk.highRiskCount)} icon={ShieldAlert} accent="danger" />
        <KpiCard label="Colaboradores em risco médio" value={formatNumber(flightRisk.mediumRiskCount)} icon={AlertTriangle} accent="gold" />
        <KpiCard label="Total sinalizado pelo modelo" value={formatNumber(flightRisk.totalFlagged)} icon={Users} accent="navy" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Correlações entre indicadores</CardTitle>
        </CardHeader>
        <CardContent>
          <RankingBarChart data={correlations} />
          <p className="mt-2 text-xs text-muted-foreground">
            Coeficiente de correlação de Pearson (-1 a 1), calculado sobre as séries mensais dos últimos 12 meses.
          </p>
        </CardContent>
      </Card>
    </div>
  );

  const managerial = (
    <Card>
      <CardHeader>
        <CardTitle>Ranking de risco por gestor</CardTitle>
      </CardHeader>
      <CardContent>
        {riskRanking.length > 0 ? (
          <RankingBarChart data={riskRanking} color="#B23A48" />
        ) : (
          <p className="text-sm text-muted-foreground">Sem sinais de risco relevantes no período.</p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Score composto por volume de desligamentos e horas de afastamento por equipe — quanto maior, maior a atenção recomendada.
        </p>
      </CardContent>
    </Card>
  );

  const operational = (
    <div className="flex flex-col gap-4">
      <Card>
        <TableCardHeader
          title="Flight Risk — colaboradores com maior probabilidade de saída"
          filename="people-analytics-flight-risk"
          data={flightRisk.topRisks.map((r) => ({
            colaborador: r.name,
            cargo: r.position,
            gestor: r.manager,
            score: r.riskScore,
            nivel: r.riskLevel,
            fatores: r.factors.join(" | "),
          }))}
          columns={[
            { key: "colaborador", label: "Colaborador" },
            { key: "cargo", label: "Cargo" },
            { key: "gestor", label: "Gestor" },
            { key: "score", label: "Score" },
            { key: "nivel", label: "Nível" },
            { key: "fatores", label: "Fatores identificados" },
          ]}
        />
        <CardContent>
          {flightRisk.topRisks.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum colaborador ativo apresenta sinais de risco no momento.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Gestor</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Nível</TableHead>
                  <TableHead>Fatores identificados</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flightRisk.topRisks.map((r) => (
                  <TableRow key={r.employeeId}>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.position}</TableCell>
                    <TableCell>{r.manager}</TableCell>
                    <TableCell>{r.riskScore}</TableCell>
                    <TableCell>
                      <Badge variant={RISK_VARIANT[r.riskLevel]}>{r.riskLevel}</Badge>
                    </TableCell>
                    <TableCell className="max-w-md whitespace-normal text-xs text-muted-foreground">
                      {r.factors.join(" · ")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Insights automáticos do período</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {insights.map((text, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border border-border p-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              <p className="text-sm">{text}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );

  const analytical = (
    <Card>
      <CardHeader>
        <CardTitle>Motor analítico e metodologia</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-navy" />
          Correlações calculadas via coeficiente de Pearson sobre séries mensais dos últimos 12 meses.
        </div>
        <div className="flex items-start gap-2">
          <UserX className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          <span>
            <strong className="text-foreground">Flight Risk</strong> é um modelo baseado em regras (não é machine
            learning de caixa-preta): cada colaborador ativo recebe pontos por desempenho abaixo do esperado,
            aumento de afastamentos, excesso de horas extras, estagnação de carreira (+3 anos sem movimentação) e
            alto potencial sem reconhecimento recente. O score e os fatores que o compõem são sempre exibidos juntos,
            para que a decisão final seja sempre humana.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning-text" />
          Score de risco por gestor combina desligamentos e horas de afastamento da equipe.
        </div>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-gold" />
          Narrativas geradas automaticamente a partir de regras sobre os principais indicadores da plataforma.
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader title="People Analytics (Insights e IA)" description="Correlações, flight risk preditivo, anomalias, forecast e narrativas automáticas para apoiar decisões estratégicas." moduleKey="people-analytics" />
      <ModuleViewTabs executive={executive} managerial={managerial} operational={operational} analytical={analytical} />
    </div>
  );
}
