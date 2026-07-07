import { resolveScopedFilters } from "@/lib/scope";
import { Target, Timer, Wallet, AlertTriangle, Users } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { ModuleViewTabs } from "@/components/dashboard/module-view-tabs";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RankingBarChart } from "@/components/dashboard/ranking-bar-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatCurrency, formatDate } from "@/lib/utils";
import { FUNNEL_STAGE_LABEL } from "@/lib/labels";
import { TableCardHeader } from "@/components/dashboard/table-card-header";
import {
  getRecrutamentoKpis,
  getFunnelByStage,
  getCandidatesBySource,
  getVacanciesByRecruiterEfficiency,
  getRecrutamentoTable,
  getCostOfVacancy,
} from "@/services/recrutamento";

export default async function RecrutamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ unidade?: string; periodo?: string }>;
}) {
  const params = await searchParams;
  const filters = await resolveScopedFilters(params);

  const [kpis, funnel, bySource, byEfficiency, table, vacancyCost] = await Promise.all([
    getRecrutamentoKpis(filters),
    getFunnelByStage(filters),
    getCandidatesBySource(filters),
    getVacanciesByRecruiterEfficiency(filters),
    getRecrutamentoTable(filters),
    getCostOfVacancy(filters),
  ]);

  const funnelData = funnel.map((f) => ({ name: FUNNEL_STAGE_LABEL[f.name as string] ?? f.name, value: f.value }));
  const totalVacancyCost = vacancyCost.reduce((acc, v) => acc + v.estimatedTotalCost, 0);

  const executive = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <KpiCard label="Vagas abertas" value={formatNumber(kpis.openVacancies)} icon={Target} accent="navy" />
        <KpiCard label="Vagas críticas" value={formatNumber(kpis.criticalVacancies)} icon={AlertTriangle} accent="danger" />
        <KpiCard label="Tempo médio de contratação" value={`${kpis.avgTimeToHire.toFixed(0)} dias`} icon={Timer} accent="gold" />
        <KpiCard label="Custo por contratação" value={formatCurrency(kpis.avgCostToHire)} icon={Wallet} accent="gold" />
        <KpiCard label="Contratados no período" value={formatNumber(kpis.hiredCount)} icon={Users} accent="success" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Funil de recrutamento por etapa</CardTitle>
        </CardHeader>
        <CardContent>
          <RankingBarChart data={funnelData} />
        </CardContent>
      </Card>
    </div>
  );

  const managerial = (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Origem dos candidatos</CardTitle>
        </CardHeader>
        <CardContent>
          {bySource.length > 0 ? <RankingBarChart data={bySource} color="#B8935A" /> : <p className="text-sm text-muted-foreground">Sem candidatos no período.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Eficiência de conversão por vaga (%)</CardTitle>
        </CardHeader>
        <CardContent>
          {byEfficiency.length > 0 ? <RankingBarChart data={byEfficiency} color="#4C8B5B" /> : <p className="text-sm text-muted-foreground">Sem dados no período.</p>}
        </CardContent>
      </Card>
    </div>
  );

  const operational = (
    <Card>
      <TableCardHeader
        title="Candidatos no período"
        filename="recrutamento-candidatos"
        data={table.map((c) => ({
          candidato: c.name,
          vaga: c.vacancy,
          origem: c.source,
          etapa: FUNNEL_STAGE_LABEL[c.stage] ?? c.stage,
          abertura: c.openedAt,
          critica: c.isCritical ? "Sim" : "Não",
        }))}
        columns={[
          { key: "candidato", label: "Candidato" },
          { key: "vaga", label: "Vaga" },
          { key: "origem", label: "Origem" },
          { key: "etapa", label: "Etapa" },
          { key: "abertura", label: "Abertura" },
          { key: "critica", label: "Crítica" },
        ]}
      />
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Candidato</TableHead>
              <TableHead>Vaga</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Etapa</TableHead>
              <TableHead>Abertura</TableHead>
              <TableHead>Crítica</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.name}</TableCell>
                <TableCell>{c.vacancy}</TableCell>
                <TableCell>{c.source}</TableCell>
                <TableCell>
                  <Badge variant={c.stage === "CONTRATADO" ? "success" : c.stage === "REPROVADO" ? "danger" : "outline"}>
                    {FUNNEL_STAGE_LABEL[c.stage] ?? c.stage}
                  </Badge>
                </TableCell>
                <TableCell>{formatDate(c.openedAt)}</TableCell>
                <TableCell>{c.isCritical ? <Badge variant="danger">Sim</Badge> : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  const analytical = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="Tempo médio de contratação" value={`${kpis.avgTimeToHire.toFixed(0)} dias`} icon={Timer} accent="gold" />
        <KpiCard label="Custo médio por contratação" value={formatCurrency(kpis.avgCostToHire)} icon={Wallet} accent="navy" />
        <KpiCard label="Custo total de vacância (posições em aberto)" value={formatCurrency(totalVacancyCost)} icon={AlertTriangle} accent="danger" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Custo de Vacância (Cost of Vacancy) por posição em aberto</CardTitle>
        </CardHeader>
        <CardContent>
          {vacancyCost.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma vaga em aberto no momento.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vaga</TableHead>
                  <TableHead>Dias em aberto</TableHead>
                  <TableHead>Custo diário estimado</TableHead>
                  <TableHead>Custo total estimado</TableHead>
                  <TableHead>Crítica</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vacancyCost.map((v) => (
                  <TableRow key={v.vacancy}>
                    <TableCell>{v.vacancy}</TableCell>
                    <TableCell>{v.daysOpen}</TableCell>
                    <TableCell>{formatCurrency(v.estimatedDailyCost)}</TableCell>
                    <TableCell>{formatCurrency(v.estimatedTotalCost)}</TableCell>
                    <TableCell>{v.isCritical ? <Badge variant="danger">Sim</Badge> : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Metodologia simplificada (SHRM/Bersin): ponto médio salarial do cargo × 1,4 (encargos e benefícios) ÷ 21
            dias úteis, multiplicado pelos dias em aberto. Representa uma estimativa de produtividade perdida, não um
            valor contábil exato.
          </p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader title="Recrutamento & Seleção" description="Funil de vagas, tempo de contratação, origem de candidatos e eficiência do processo seletivo." moduleKey="recrutamento" />
      <ModuleViewTabs executive={executive} managerial={managerial} operational={operational} analytical={analytical} />
    </div>
  );
}
