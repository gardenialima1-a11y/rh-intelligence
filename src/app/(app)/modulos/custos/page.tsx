import { resolveScopedFilters } from "@/lib/scope";
import { Wallet, TrendingUp, TrendingDown, Percent, Users, Scale, ArrowDownRight, UserPlus, UserMinus, ArrowUpCircle, Clock, Package, Gift, Sparkles, Target, Stethoscope, ShieldCheck } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { ModuleViewTabs } from "@/components/dashboard/module-view-tabs";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { RankingBarChart } from "@/components/dashboard/ranking-bar-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddBenchmarkDialog } from "@/components/admin/add-benchmark-dialog";
import { BenchmarkTable } from "@/components/admin/benchmark-table";
import { SectorFilterInline } from "@/components/dashboard/sector-filter-inline";
import { PayrollDetailFilters } from "@/components/dashboard/payroll-detail-filters";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { lastNMonthsKeys, monthLabelsPtBR } from "@/services/period";
import { getCustosKpis, getCostTrend, getCostByCostCenter, getCostBySecondaryCostCenter, getAverageSalaryByPosition } from "@/services/custos";
import { getAvailableDetailCompetences, getPayrollDetailReport, getPayrollDetailTotals } from "@/services/custos-detalhado";
import { getCostInsights, getAvailableInsightsCompetences, formatMonthNamePtBR as monthLabelPtBR } from "@/services/custos-insights";
import { CostInsightsMonthFilters } from "@/components/dashboard/cost-insights-month-filters";
import { getSalaryBenchmarkComparison, getBenchmarkSummary } from "@/services/salary-benchmark";
import { getPositionsWithoutBenchmark } from "@/actions/salary-benchmark";
import { PayrollImportDialog } from "@/components/admin/payroll-import-dialog";
import { PayrollPdfImportDialog } from "@/components/admin/payroll-pdf-import-dialog";
import { ExtraBenefitsImportDialog } from "@/components/admin/extra-benefits-import-dialog";
import { prisma } from "@/lib/prisma";
import { getCustoRealAtestados, getFaltasInjustificadasCruzadas } from "@/services/absenteismo-custo-real";

export default async function CustosPage({
  searchParams,
}: {
  searchParams: Promise<{
    unidade?: string;
    periodo?: string;
    setorPrincipal?: string;
    setorSecundario?: string;
    mes?: string;
    colaborador?: string;
    insightsAtual?: string;
    insightsComparar?: string;
  }>;
}) {
  const params = await searchParams;
  const filters = await resolveScopedFilters(params);

  const [
    kpis,
    trend,
    byCostCenter,
    bySecondaryCostCenter,
    avgSalaryByPosition,
    benchmarkRows,
    benchmarkSummary,
    positionsWithoutBenchmark,
    employees,
    sectors,
    detailCompetences,
  ] = await Promise.all([
    getCustosKpis(filters),
    getCostTrend(filters),
    getCostByCostCenter(filters),
    getCostBySecondaryCostCenter(filters),
    getAverageSalaryByPosition(filters),
    getSalaryBenchmarkComparison(),
    getBenchmarkSummary(),
    getPositionsWithoutBenchmark(),
    prisma.employee.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.costCenter.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getAvailableDetailCompetences(),
  ]);

  // Cruzamento com o módulo de Absenteísmo: quanto os atestados médicos custaram de
  // verdade (salário real da folha) e quais faltas injustificadas realmente tiveram
  // desconto correspondente naquele mês (as demais podem ter sido acordadas com o
  // gestor, e por isso não entram como custo/penalização).
  const [custoAtestadoRows, faltaCruzadaRows] = await Promise.all([
    getCustoRealAtestados(filters),
    getFaltasInjustificadasCruzadas(filters),
  ]);
  const custoAtestadoTotal = custoAtestadoRows.reduce((s, r) => s + r.cost, 0);
  const faltaCruzadaTotais = faltaCruzadaRows.reduce(
    (acc, r) => {
      if (r.status === "CONFIRMADA") {
        acc.confirmadas += r.ocorrencias;
        acc.custoConfirmado += r.valorDescontado ?? 0;
      } else if (r.status === "ABONADA") {
        acc.abonadas += r.ocorrencias;
      } else {
        acc.indeterminadas += r.ocorrencias;
      }
      return acc;
    },
    { confirmadas: 0, abonadas: 0, indeterminadas: 0, custoConfirmado: 0 }
  );

  const insightsCompetences = await getAvailableInsightsCompetences();

  const { competenceKey: detailCompetenceKey, rows: detailRows } = await getPayrollDetailReport({
    competenceKey: params.mes,
    costCenterId: filters.costCenterId,
    secondaryCostCenterId: filters.secondaryCostCenterId,
    employeeId: params.colaborador,
  });
  const { proventoTotals, descontoTotals, extraBenefitTotals } = getPayrollDetailTotals(detailRows);
  const insights = await getCostInsights(
    params.insightsAtual ?? insightsCompetences[0],
    params.insightsComparar
  );

  const monthLabels = monthLabelsPtBR(lastNMonthsKeys(12));

  const executive = (
    <div className="flex flex-col gap-4">
      <Card className="border-gold/40" id="insights">
        <CardHeader className="flex-col items-start gap-3 space-y-0 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold-text" />
            <CardTitle>
              Insights estratégicos
              {insights.currentCompetence && insights.previousCompetence
                ? ` — ${monthLabelPtBR(insights.currentCompetence)} vs ${monthLabelPtBR(insights.previousCompetence)}`
                : ""}
            </CardTitle>
          </div>
          {insightsCompetences.length > 0 && <CostInsightsMonthFilters competences={insightsCompetences} />}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            {insights.narrative.map((line, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                {i === 0 ? (
                  insights.delta >= 0 ? (
                    <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                  ) : (
                    <TrendingDown className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  )
                ) : (
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                )}
                <span className={i === 0 ? "font-medium text-navy dark:text-cream" : "text-muted-foreground"}>{line}</span>
              </div>
            ))}
          </div>

          {insights.hasPreviousData && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {insights.headcountBySector.length > 0 && (
                <details className="rounded-lg border border-gold/40 p-2.5 sm:col-span-2 xl:col-span-3" open>
                  <summary className="flex cursor-pointer items-center gap-2 text-xs font-medium text-navy dark:text-cream">
                    <Target className="h-3.5 w-3.5" /> Admissões: substituição ou aumento de quadro? ({insights.headcountBySector.length} setor(es))
                  </summary>
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-muted-foreground">
                          <th className="pb-1 pr-3 font-medium">Setor</th>
                          <th className="pb-1 pr-3 font-medium">Admissões</th>
                          <th className="pb-1 pr-3 font-medium">Saídas</th>
                          <th className="pb-1 pr-3 font-medium">Diagnóstico</th>
                          <th className="pb-1 font-medium">Quadro atual (real / ideal)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {insights.headcountBySector.map((s) => (
                          <tr key={s.costCenterId} className="border-t border-border">
                            <td className="py-1.5 pr-3">{s.costCenterName}</td>
                            <td className="py-1.5 pr-3">{s.admissoesCount} ({formatCurrency(s.admissoesValor)})</td>
                            <td className="py-1.5 pr-3">{s.saidasCount}</td>
                            <td className="py-1.5 pr-3">
                              {s.diagnostico === "substituicao" && <span className="text-muted-foreground">Substituição</span>}
                              {s.diagnostico === "complemento_quadro" && <span className="text-warning-text">Complemento de quadro (estava abaixo do ideal)</span>}
                              {s.diagnostico === "aumento_alem_do_ideal" && <span className="font-medium text-danger">Aumento além do ideal (+{s.netChange})</span>}
                              {s.diagnostico === "reducao" && <span className="text-success">Redução de quadro ({s.netChange})</span>}
                            </td>
                            <td className="py-1.5">
                              {s.situacaoQuadro === "sem_meta" && <span className="text-muted-foreground">{s.realHeadcountAtual} (sem meta cadastrada)</span>}
                              {s.situacaoQuadro === "no_ideal" && <span className="text-success">{s.realHeadcountAtual} / {s.idealHeadcount}</span>}
                              {s.situacaoQuadro === "acima_do_ideal" && <span className="font-medium text-danger">{s.realHeadcountAtual} / {s.idealHeadcount} (acima)</span>}
                              {s.situacaoQuadro === "abaixo_do_ideal" && <span className="text-warning-text">{s.realHeadcountAtual} / {s.idealHeadcount} (abaixo)</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Quadro ideal é o mesmo cadastrado no módulo Headcount, por centro de custo secundário. &quot;Sem meta
                      cadastrada&quot; significa que ninguém definiu um número ideal pra esse setor ainda.
                    </p>
                  </div>
                </details>
              )}

              {insights.admissoes.length > 0 && (
                <details className="rounded-lg border border-border p-2.5">
                  <summary className="flex cursor-pointer items-center gap-2 text-xs font-medium text-navy dark:text-cream">
                    <UserPlus className="h-3.5 w-3.5" /> Admissões confirmadas ({insights.admissoes.length})
                  </summary>
                  <div className="mt-2 flex flex-col gap-1">
                    {insights.admissoes.map((a, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {a.employeeName}{a.costCenterName ? ` · ${a.costCenterName}` : ""} · admitido em {a.admissionDate}
                        </span>
                        <span>{formatCurrency(a.valor)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {insights.reaparecimentos.length > 0 && (
                <details className="rounded-lg border border-warning/40 p-2.5">
                  <summary className="flex cursor-pointer items-center gap-2 text-xs font-medium text-navy dark:text-cream">
                    <UserPlus className="h-3.5 w-3.5" /> Reapareceram (não são admissão nova) ({insights.reaparecimentos.length})
                  </summary>
                  <div className="mt-2 flex flex-col gap-1">
                    {insights.reaparecimentos.map((r, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {r.employeeName}{r.costCenterName ? ` · ${r.costCenterName}` : ""} · admitido em {r.admissionDate}
                          {r.provavelMotivo === "afastamento_inss_anterior" ? " (voltando de afastamento INSS)" : " (motivo não identificado — confira férias/importação)"}
                        </span>
                        <span>{formatCurrency(r.valor)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {insights.saidas.length > 0 && (
                <details className="rounded-lg border border-border p-2.5">
                  <summary className="flex cursor-pointer items-center gap-2 text-xs font-medium text-navy dark:text-cream">
                    <UserMinus className="h-3.5 w-3.5" /> Saídas da folha ({insights.saidas.length})
                  </summary>
                  <div className="mt-2 flex flex-col gap-1">
                    {insights.saidas.map((s, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {s.employeeName}{s.costCenterName ? ` · ${s.costCenterName}` : ""}
                          {s.virouRescisao
                            ? " (rescisão)"
                            : s.afastadoINSS
                              ? " (afastado pelo INSS)"
                              : " (sem desligamento ou afastamento registrado)"}
                        </span>
                        <span>{formatCurrency(s.valorAnterior)}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {insights.reajustes.length > 0 && (
                <details className="rounded-lg border border-border p-2.5">
                  <summary className="flex cursor-pointer items-center gap-2 text-xs font-medium text-navy dark:text-cream">
                    <ArrowUpCircle className="h-3.5 w-3.5" /> Reajustes salariais ({insights.reajustes.length})
                  </summary>
                  <div className="mt-2 flex flex-col gap-1">
                    {insights.reajustes.map((r, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{r.employeeName}{r.costCenterName ? ` · ${r.costCenterName}` : ""}</span>
                        <span className={r.delta >= 0 ? "text-danger" : "text-success"}>
                          {formatCurrency(r.salarioAnterior)} → {formatCurrency(r.salarioAtual)}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {insights.horasExtrasByCostCenter.length > 0 && (
                <details className="rounded-lg border border-border p-2.5">
                  <summary className="flex cursor-pointer items-center gap-2 text-xs font-medium text-navy dark:text-cream">
                    <Clock className="h-3.5 w-3.5" /> Hora extra por centro de custo
                  </summary>
                  <div className="mt-2 flex flex-col gap-1">
                    {insights.horasExtrasByCostCenter.map((h, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{h.label}</span>
                        <span className={h.delta >= 0 ? "text-danger" : "text-success"}>
                          {formatCurrency(h.anterior)} → {formatCurrency(h.atual)}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {insights.outrosProventos.length > 0 && (
                <details className="rounded-lg border border-border p-2.5">
                  <summary className="flex cursor-pointer items-center gap-2 text-xs font-medium text-navy dark:text-cream">
                    <Package className="h-3.5 w-3.5" /> Outros proventos que mais mudaram
                  </summary>
                  <div className="mt-2 flex flex-col gap-1">
                    {insights.outrosProventos.map((o, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{o.label}</span>
                        <span className={o.delta >= 0 ? "text-danger" : "text-success"}>
                          {formatCurrency(o.anterior)} → {formatCurrency(o.atual)}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {insights.beneficiosExtra.length > 0 && (
                <details className="rounded-lg border border-border p-2.5">
                  <summary className="flex cursor-pointer items-center gap-2 text-xs font-medium text-navy dark:text-cream">
                    <Gift className="h-3.5 w-3.5" /> Benefícios extra-folha
                  </summary>
                  <div className="mt-2 flex flex-col gap-1">
                    {insights.beneficiosExtra.map((b, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{b.label}</span>
                        <span className={b.delta >= 0 ? "text-danger" : "text-success"}>
                          {formatCurrency(b.anterior)} → {formatCurrency(b.atual)}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-danger/30" id="custo-afastamentos">
        <CardHeader>
          <CardTitle>Custo de afastamentos (cruzado com Absenteísmo)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <KpiCard
              label="Custo real de atestados"
              value={formatCurrency(custoAtestadoTotal)}
              icon={Stethoscope}
              accent="danger"
              tooltip="Quanto a empresa pagou de salário durante os dias de atestado médico no período, usando o salário real da folha do mês (quando disponível) em vez de uma estimativa por faixa de cargo. Ver detalhamento por colaborador e por setor no módulo Absenteísmo."
            />
            <KpiCard
              label="Faltas injustificadas confirmadas"
              value={formatCurrency(faltaCruzadaTotais.custoConfirmado)}
              icon={ShieldCheck}
              accent="danger"
              tooltip={`${formatCurrency(faltaCruzadaTotais.custoConfirmado)} em desconto na folha, referentes a ${faltaCruzadaTotais.confirmadas} falta(s) com desconto confirmado. Não inclui as ${faltaCruzadaTotais.abonadas} falta(s) sem desconto (provavelmente acordadas com o gestor) nem as ${faltaCruzadaTotais.indeterminadas} sem folha detalhada pra confirmar.`}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Esses valores cruzam o relatório de ponto com a folha de pagamento importada: uma falta só conta como
            injustificada de verdade quando existe desconto correspondente na folha daquele mês — sem desconto, pode
            ter sido negociada com o gestor e não entra aqui. Veja o detalhamento por colaborador, por setor e por mês
            na aba Operacional do módulo{" "}
            <a href="/modulos/absenteismo#custo-atestados" className="font-medium text-navy underline dark:text-cream">
              Absenteísmo
            </a>
            .
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Folha salarial total" value={formatCurrency(kpis.totalCost)} icon={Wallet} accent="navy" tooltip={"Soma do campo Custo Total de cada lançamento de folha (Salário Base + Benefícios + Encargos) de colaboradores ativos no período selecionado."} />
        <KpiCard label="Custo / Receita" value={kpis.costToRevenueRatio ? formatPercent(kpis.costToRevenueRatio) : "sem receita"} icon={Percent} accent="gold" tooltip={"Folha salarial total dividida pela Receita cadastrada no mesmo período (painel Receita, na aba Administração). Mostra \"sem receita\" quando não há valor de receita lançado."} />
        <KpiCard label="Custo por headcount" value={formatCurrency(kpis.costPerHeadcount)} icon={Users} accent="gold" tooltip={"Folha salarial total dividida pelo número de colaboradores ativos no período."} />
        <KpiCard label="Receita no período" value={formatCurrency(kpis.totalRevenue)} icon={TrendingUp} accent="success" tooltip={"Soma dos lançamentos de Receita cadastrados manualmente no painel Receita (aba Administração) para o período selecionado."} />
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
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Custo por centro de custo principal</CardTitle>
          </CardHeader>
          <CardContent>
            {byCostCenter.length > 0 ? <RankingBarChart data={byCostCenter} /> : <p className="text-sm text-muted-foreground">Sem dados.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Custo por centro de custo secundário</CardTitle>
          </CardHeader>
          <CardContent>
            {bySecondaryCostCenter.length > 0 ? (
              <RankingBarChart data={bySecondaryCostCenter} color="#7A6A4F" />
            ) : (
              <p className="text-sm text-muted-foreground">Nenhum colaborador com centro de custo secundário cadastrado.</p>
            )}
          </CardContent>
        </Card>
      </div>
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
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-col items-start gap-3 space-y-0 md:flex-row md:items-center md:justify-between">
          <CardTitle>Composição do custo de pessoal</CardTitle>
          <div className="flex flex-wrap gap-2">
            <PayrollPdfImportDialog employees={employees} />
            <PayrollImportDialog />
            <ExtraBenefitsImportDialog />
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <KpiCard label="Salário base" value={formatCurrency(kpis.baseSalaryTotal)} icon={Wallet} accent="navy" tooltip={"Soma do campo Salário Base de todos os lançamentos de folha no período, sem benefícios nem encargos."} />
          <KpiCard label="Benefícios" value={formatCurrency(kpis.benefitsCost)} icon={Wallet} accent="gold" tooltip={"Soma do campo Benefícios de todos os lançamentos de folha no período, somada aos benefícios pagos fora da folha (auxílio combustível, cesta básica, premiações, etc)."} />
          <KpiCard label="Encargos" value={formatCurrency(kpis.chargesCost)} icon={Wallet} accent="danger" tooltip={"Soma do campo Encargos de todos os lançamentos de folha no período (INSS, FGTS e demais encargos sobre a folha)."} />
          <KpiCard label="Benefícios extra-folha" value={formatCurrency(kpis.extraBenefitsTotal)} icon={Wallet} accent="success" tooltip={"Soma de tudo que foi importado como benefício pago fora da folha (auxílio combustível, ajuda de custo, cesta básica, vale alimentação, premiações, salário 2, vale transporte) no período."} />
        </CardContent>
      </Card>

      {detailCompetences.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhum mês com detalhamento importado ainda. Use &quot;Importar PDF da folha&quot; acima — o detalhamento
            completo (periculosidade, insalubridade, todos os proventos e descontos) é gerado automaticamente a
            partir do PDF.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="flex-col items-start gap-3 space-y-0 md:flex-row md:items-center md:justify-between">
              <CardTitle>Detalhamento completo — {detailCompetenceKey ?? "—"}</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <PayrollDetailFilters competences={detailCompetences} employees={employees} />
                <SectorFilterInline sectors={sectors} />
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Proventos — todos os tipos ({proventoTotals.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {proventoTotals.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados para esse filtro.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                  {proventoTotals.map((t) => (
                    <div key={t.verba} className="flex flex-col gap-0.5 rounded-lg border border-border p-2.5">
                      <span className="text-[11px] leading-tight text-muted-foreground">{t.label}</span>
                      <span className="text-sm font-medium text-navy dark:text-cream">{formatCurrency(t.total)}</span>
                      <span className="text-[10px] text-muted-foreground">{t.count} lançamento(s)</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Descontos — todos os tipos ({descontoTotals.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {descontoTotals.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem dados para esse filtro.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                  {descontoTotals.map((t) => (
                    <div key={t.verba} className="flex flex-col gap-0.5 rounded-lg border border-border p-2.5">
                      <span className="text-[11px] leading-tight text-muted-foreground">{t.label}</span>
                      <span className="text-sm font-medium text-navy dark:text-cream">{formatCurrency(t.total)}</span>
                      <span className="text-[10px] text-muted-foreground">{t.count} lançamento(s)</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Benefícios extra-folha — todos os tipos ({extraBenefitTotals.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {extraBenefitTotals.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum benefício extra-folha importado pra esse mês ainda. Use &quot;Importar benefícios
                  extra-folha&quot; no topo da página.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
                  {extraBenefitTotals.map((t) => (
                    <div key={t.verba} className="flex flex-col gap-0.5 rounded-lg border border-border p-2.5">
                      <span className="text-[11px] leading-tight text-muted-foreground">{t.label}</span>
                      <span className="text-sm font-medium text-navy dark:text-cream">{formatCurrency(t.total)}</span>
                      <span className="text-[10px] text-muted-foreground">{t.count} colaborador(es)</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{detailRows.length} colaborador(es)</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {detailRows.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Nenhum colaborador encontrado para esse filtro.</p>
              ) : (
                detailRows.map((r) => (
                  <details key={r.employeeId} className="group rounded-lg border border-border">
                    <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-3 text-sm">
                      <div className="flex flex-col">
                        <span className="font-medium text-navy dark:text-cream">{r.employeeName}</span>
                        <span className="text-xs text-muted-foreground">
                          Mat. {r.registration} · {r.costCenterName ?? "Sem centro de custo principal"}
                          {r.secondaryCostCenterName ? ` · ${r.secondaryCostCenterName}` : ""}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-navy dark:text-cream">
                        Custo total: {formatCurrency(r.grandTotal)}
                      </span>
                    </summary>

                    <div className="grid grid-cols-1 gap-4 border-t border-border p-3 md:grid-cols-3">
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted-foreground">Proventos ({formatCurrency(r.totalProventos)})</p>
                        <div className="flex flex-col gap-1">
                          {r.proventos.map((p, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{p.descricao}</span>
                              <span>{formatCurrency(p.valor)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted-foreground">Descontos ({formatCurrency(r.totalDescontos)})</p>
                        <div className="flex flex-col gap-1">
                          {r.descontos.map((d, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{d.descricao}</span>
                              <span>{formatCurrency(d.valor)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted-foreground">Benefícios extra-folha ({formatCurrency(r.extraBenefitsTotal)})</p>
                        <div className="flex flex-col gap-1">
                          {r.extraBenefits.length === 0 ? (
                            <p className="text-xs text-muted-foreground">Nenhum importado pra esse mês.</p>
                          ) : (
                            r.extraBenefits.map((b, i) => (
                              <div key={i} className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">{b.categoria}</span>
                                <span>{formatCurrency(b.valor)}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </details>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );

  const analytical = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Custo / Receita" value={kpis.costToRevenueRatio ? formatPercent(kpis.costToRevenueRatio) : "—"} icon={Percent} accent="gold" tooltip={"Folha salarial total dividida pela Receita cadastrada no mesmo período (painel Receita, na aba Administração). Mostra \"sem receita\" quando não há valor de receita lançado."} />
        <KpiCard label="Custo por headcount" value={formatCurrency(kpis.costPerHeadcount)} icon={Users} accent="navy" tooltip={"Folha salarial total dividida pelo número de colaboradores ativos no período."} />
        <KpiCard
          label="Cargos abaixo do mercado"
          value={String(benchmarkSummary.positionsBelowMarket)}
          icon={ArrowDownRight}
          accent={benchmarkSummary.positionsBelowMarket > 0 ? "danger" : "success"}
        tooltip={"Quantidade de cargos cujo salário médio pago pela empresa ficou mais de 5% abaixo da média de mercado cadastrada no Benchmarking Salarial."}
      />
        <KpiCard
          label="Gap médio vs. mercado"
          value={benchmarkSummary.positionsComparable > 0 ? formatPercent(benchmarkSummary.avgGapPercent / 100) : "sem dados"}
          icon={Scale}
          accent="gold"
        tooltip={"Média da diferença percentual entre o salário médio da empresa e a média de mercado, considerando só os cargos que têm as duas referências cadastradas. Fórmula por cargo: ((salário empresa - salário mercado) / salário mercado) x 100."}
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
