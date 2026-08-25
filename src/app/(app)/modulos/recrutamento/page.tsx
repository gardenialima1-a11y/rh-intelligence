import { resolveScopedFilters } from "@/lib/scope";
import { Target, Timer, Wallet, AlertTriangle, Users, FileDown } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { ModuleViewTabs } from "@/components/dashboard/module-view-tabs";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RankingBarChart } from "@/components/dashboard/ranking-bar-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNumber, formatCurrency } from "@/lib/utils";
import { FUNNEL_STAGE_LABEL } from "@/lib/labels";
import { VacancyFormDialog } from "@/components/admin/vacancy-form-dialog";
import { VacanciesTable } from "@/components/admin/vacancies-table";
import { CandidateFormDialog } from "@/components/admin/candidate-form-dialog";
import { CandidatesTable } from "@/components/admin/candidates-table";
import { getVacancies } from "@/actions/vacancies";
import { getCandidatesForAdmin } from "@/actions/candidates";
import { getClosedVacanciesHistory } from "@/services/vacancy-report";
import { ClosedVacanciesTable } from "@/components/dashboard/closed-vacancies-table";
import { prisma } from "@/lib/prisma";
import {
  getRecrutamentoKpis,
  getFunnelByStage,
  getCandidatesBySource,
  getVacanciesByRecruiterEfficiency,
  getRecrutamentoTable,
  getCostOfVacancy,
} from "@/services/recrutamento";
import {
  getStageTimeline,
  getSalaDeVagas,
  getQualityOfHire,
  getVacancyPipelines,
} from "@/services/recrutamento-timeline";
import { SalaDeVagas } from "@/components/dashboard/sala-de-vagas";
import { RecruitmentStageTimeline } from "@/components/dashboard/recruitment-stage-timeline";
import { VacancyPipelineBoard } from "@/components/dashboard/vacancy-pipeline-board";
import { LiveRefresher } from "@/components/dashboard/live-refresher";

export default async function RecrutamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ unidade?: string; periodo?: string }>;
}) {
  const params = await searchParams;
  const filters = await resolveScopedFilters(params);

  const [
    kpis,
    funnel,
    bySource,
    byEfficiency,
    ,
    vacancyCost,
    vacancies,
    positions,
    units,
    candidatesAdmin,
    closedVacancies,
    stageTimeline,
    salaDeVagas,
    qualityOfHire,
    vacancyPipelines,
  ] = await Promise.all([
    getRecrutamentoKpis(filters),
    getFunnelByStage(filters),
    getCandidatesBySource(filters),
    getVacanciesByRecruiterEfficiency(filters),
    getRecrutamentoTable(filters),
    getCostOfVacancy(filters),
    getVacancies(),
    prisma.position.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.unit.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getCandidatesForAdmin(),
    getClosedVacanciesHistory(),
    getStageTimeline(),
    getSalaDeVagas(),
    getQualityOfHire(),
    getVacancyPipelines(),
  ]);

  const funnelData = funnel.map((f) => ({ name: FUNNEL_STAGE_LABEL[f.name as string] ?? f.name, value: f.value }));
  const totalVacancyCost = vacancyCost.reduce((acc, v) => acc + v.estimatedTotalCost, 0);
  const openVacanciesManaged = vacancies.filter((v) => v.status === "ABERTA" || v.status === "EM_ANDAMENTO").length;

  const executive = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
        <KpiCard label="Vagas abertas" value={formatNumber(kpis.openVacancies)} icon={Target} accent="navy" tooltip={"Total de vagas com status Aberta ou Em andamento, contado direto do cadastro de vagas (mesma fonte da aba Operacional)."} />
        <KpiCard label="Vagas críticas" value={formatNumber(kpis.criticalVacancies)} icon={AlertTriangle} accent="danger" tooltip={"Entre as vagas abertas/em andamento, quantas foram marcadas como Crítica no cadastro da vaga."} />
        <KpiCard label="Tempo médio de contratação" value={`${kpis.avgTimeToHire.toFixed(0)} dias`} icon={Timer} accent="gold" tooltip={"Média de dias entre a abertura do candidato no funil (openedAt) e a data em que foi marcado como Contratado (hiredAt), considerando os contratados no período."} />
        <KpiCard label="Custo por contratação" value={formatCurrency(kpis.avgCostToHire)} icon={Wallet} accent="gold" tooltip={"Média do campo Custo de Contratação preenchido nos candidatos marcados como Contratado no período (só considera quem tem esse valor preenchido)."} />
        <KpiCard label="Contratados no período" value={formatNumber(kpis.hiredCount)} icon={Users} accent="success" tooltip={"Total de candidatos com etapa do funil igual a Contratado e data de contratação dentro do período selecionado."} />
        <KpiCard label="Qualidade da contratação" value={qualityOfHire !== null ? `${qualityOfHire}%` : "—"} icon={Users} accent="success" tooltip={"Média das notas de avaliação (0-100) preenchidas manualmente 90 dias após a contratação, no campo Nota de qualidade do candidato."} />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div className="flex flex-col gap-1">
            <CardTitle>Pipeline de vagas — status ao vivo</CardTitle>
            <p className="text-xs text-muted-foreground">
              Em qual etapa cada candidato está agora, vaga por vaga: Triagem → Entrevista RH → Entrevista Gestor →
              Teste → Proposta → Contratado.
            </p>
          </div>
          <LiveRefresher intervalSeconds={25} />
        </CardHeader>
        <CardContent>
          <VacancyPipelineBoard vagas={vacancyPipelines} />
        </CardContent>
      </Card>

      <SalaDeVagas vagas={salaDeVagas} />

      <Card>
        <CardHeader>
          <CardTitle>Tempo médio por etapa (histórico)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Tempo médio gasto em cada etapa, do currículo até a contratação — considerando todos os candidatos já
            cadastrados.
          </p>
        </CardHeader>
        <CardContent>
          <RecruitmentStageTimeline data={stageTimeline} />
        </CardContent>
      </Card>

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
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div className="flex flex-col gap-1">
            <CardTitle>Gestão de Vagas — status e SLA</CardTitle>
            <p className="text-xs text-muted-foreground">
              {openVacanciesManaged} vaga(s) em aberto/andamento cadastradas nesta tela.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href="/api/reports/recrutamento" title="Baixar PDF com o status atual de todas as vagas">
                <FileDown className="h-3.5 w-3.5" /> Relatório PDF (todas as vagas)
              </a>
            </Button>
            <VacancyFormDialog positions={positions} units={units} mode="create" />
          </div>
        </CardHeader>
        <CardContent>
          {vacancies.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhuma vaga cadastrada ainda. Clique em &quot;Nova vaga&quot; para começar a acompanhar o SLA de preenchimento.
            </p>
          ) : (
            <VacanciesTable vacancies={vacancies} positions={positions} units={units} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div className="flex flex-col gap-1">
            <CardTitle>Candidatos</CardTitle>
            <p className="text-xs text-muted-foreground">{candidatesAdmin.length} candidato(s) cadastrado(s).</p>
          </div>
          <CandidateFormDialog vacancies={vacancies.map((v) => ({ id: v.id, title: v.title }))} mode="create" />
        </CardHeader>
        <CardContent>
          {candidatesAdmin.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum candidato cadastrado ainda. Clique em &quot;Novo candidato&quot; para começar.
            </p>
          ) : (
            <CandidatesTable candidates={candidatesAdmin} vacancies={vacancies.map((v) => ({ id: v.id, title: v.title }))} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-1">
            <CardTitle>Histórico de vagas fechadas</CardTitle>
            <p className="text-xs text-muted-foreground">
              {closedVacancies.length} vaga(s) preenchida(s) ou cancelada(s). Fecha sozinha quando um candidato é marcado como &quot;Contratado&quot;.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <ClosedVacanciesTable rows={closedVacancies} />
        </CardContent>
      </Card>
    </div>
  );

  const analytical = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="Tempo médio de contratação" value={`${kpis.avgTimeToHire.toFixed(0)} dias`} icon={Timer} accent="gold" tooltip={"Média de dias entre a abertura do candidato no funil (openedAt) e a data em que foi marcado como Contratado (hiredAt), considerando os contratados no período."} />
        <KpiCard label="Custo médio por contratação" value={formatCurrency(kpis.avgCostToHire)} icon={Wallet} accent="navy" tooltip={"Média do campo Custo de Contratação preenchido nos candidatos marcados como Contratado no período."} />
        <KpiCard label="Custo total de vacância (posições em aberto)" value={formatCurrency(totalVacancyCost)} icon={AlertTriangle} accent="danger" tooltip={"Soma do Custo de Vacância estimado (metodologia SHRM/Bersin: ponto médio salarial do cargo x 1,4 / 21 dias úteis x dias em aberto) de todas as vagas abertas hoje."} />
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
