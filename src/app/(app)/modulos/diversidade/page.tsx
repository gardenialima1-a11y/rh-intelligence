import { resolveScopedFilters } from "@/lib/scope";
import { Fingerprint, Users, ShieldCheck, Trophy, Scale } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { ModuleViewTabs } from "@/components/dashboard/module-view-tabs";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RankingBarChart } from "@/components/dashboard/ranking-bar-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatPercent, formatCurrency } from "@/lib/utils";
import { getDiversidadeKpis, getGenderByArea, getAgeDistribution, getPayEquityByPosition, getOverallPayGap } from "@/services/diversidade";

export default async function DiversidadePage({
  searchParams,
}: {
  searchParams: Promise<{ unidade?: string; periodo?: string }>;
}) {
  const params = await searchParams;
  const filters = await resolveScopedFilters(params);

  const [kpis, genderByArea, ageDistribution, payEquity, overallGap] = await Promise.all([
    getDiversidadeKpis(filters),
    getGenderByArea(filters),
    getAgeDistribution(filters),
    getPayEquityByPosition(filters),
    getOverallPayGap(filters),
  ]);

  const executive = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Mulheres no quadro" value={formatPercent(kpis.womenRate)} icon={Users} accent="gold" />
        <KpiCard label="Mulheres em liderança" value={formatPercent(kpis.womenInLeadershipRate)} icon={Trophy} accent="navy" />
        <KpiCard
          label="Gap salarial de gênero (média)"
          value={formatPercent(overallGap.overallGapPercent / 100)}
          icon={Scale}
          accent={overallGap.overallGapPercent > 5 ? "danger" : "success"}
        />
        <KpiCard
          label="Cota PCD (atual x legal)"
          value={`${formatPercent(kpis.pcdRate)} / ${formatPercent(kpis.pcdLegalTarget)}`}
          icon={ShieldCheck}
          accent={kpis.pcdRate >= kpis.pcdLegalTarget ? "success" : "danger"}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Mulheres por centro de custo</CardTitle>
        </CardHeader>
        <CardContent>
          {genderByArea.length > 0 ? <RankingBarChart data={genderByArea} /> : <p className="text-sm text-muted-foreground">Sem dados.</p>}
        </CardContent>
      </Card>
    </div>
  );

  const managerial = (
    <Card>
      <CardHeader>
        <CardTitle>Diversidade etária</CardTitle>
      </CardHeader>
      <CardContent>
        <RankingBarChart data={ageDistribution} color="#B8935A" horizontal={false} />
      </CardContent>
    </Card>
  );

  const operational = (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Conformidade de cotas legais</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <KpiCard label="PCD — atual x meta legal" value={`${formatPercent(kpis.pcdRate)} / ${formatPercent(kpis.pcdLegalTarget)}`} icon={ShieldCheck} accent={kpis.pcdRate >= kpis.pcdLegalTarget ? "success" : "danger"} />
          <KpiCard label="Jovem Aprendiz — atual x meta legal" value={`${formatPercent(kpis.apprenticeRate)} / ${formatPercent(kpis.apprenticeLegalTarget)}`} icon={Fingerprint} accent={kpis.apprenticeRate >= kpis.apprenticeLegalTarget ? "success" : "danger"} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Equidade salarial por cargo (gender pay gap)</CardTitle>
        </CardHeader>
        <CardContent>
          {payEquity.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Sem cargos com dados suficientes para comparação.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Salário médio — Homens</TableHead>
                  <TableHead>Salário médio — Mulheres</TableHead>
                  <TableHead>Gap</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payEquity.map((r) => (
                  <TableRow key={r.position}>
                    <TableCell>{r.position}</TableCell>
                    <TableCell>{r.avgMale ? formatCurrency(r.avgMale) : "—"}</TableCell>
                    <TableCell>{r.avgFemale ? formatCurrency(r.avgFemale) : "—"}</TableCell>
                    <TableCell>
                      {r.gapPercent === null ? (
                        <Badge variant="outline">Sem comparação</Badge>
                      ) : (
                        <Badge variant={Math.abs(r.gapPercent) > 5 ? "danger" : "success"}>
                          {r.gapPercent > 0 ? "-" : "+"}
                          {Math.abs(r.gapPercent).toFixed(1)}%
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Gap positivo (vermelho) indica que mulheres recebem, em média, menos que homens no mesmo cargo — acima de
            5% é o limiar de atenção usado por referências de mercado (Mercer/WTW) e pela legislação de transparência salarial.
          </p>
        </CardContent>
      </Card>
    </div>
  );

  const analytical = (
    <Card>
      <CardHeader>
        <CardTitle>Indicadores analíticos</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="Mulheres no quadro" value={formatPercent(kpis.womenRate)} icon={Users} accent="gold" />
        <KpiCard label="Cargos com gap > 5%" value={String(overallGap.positionsWithGap)} icon={Scale} accent="danger" />
        <KpiCard label="Cargos analisados" value={String(overallGap.positionsAnalyzed)} icon={ShieldCheck} accent="navy" />
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader title="Diversidade & Inclusão" description="Cotas legais, equidade salarial de gênero e indicadores de diversidade de idade e PCD." moduleKey="diversidade" />
      <ModuleViewTabs executive={executive} managerial={managerial} operational={operational} analytical={analytical} />
    </div>
  );
}
