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
import { SectorFilterInline } from "@/components/dashboard/sector-filter-inline";
import { PayrollDetailFilters } from "@/components/dashboard/payroll-detail-filters";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { lastNMonthsKeys, monthLabelsPtBR } from "@/services/period";
import { getCustosKpis, getCostTrend, getCostByCostCenter, getCostBySecondaryCostCenter, getAverageSalaryByPosition } from "@/services/custos";
import { getAvailableDetailCompetences, getPayrollDetailReport, getPayrollDetailTotals } from "@/services/custos-detalhado";
import { getSalaryBenchmarkComparison, getBenchmarkSummary } from "@/services/salary-benchmark";
import { getPositionsWithoutBenchmark } from "@/actions/salary-benchmark";
import { PayrollImportDialog } from "@/components/admin/payroll-import-dialog";
import { PayrollPdfImportDialog } from "@/components/admin/payroll-pdf-import-dialog";
import { prisma } from "@/lib/prisma";

export default async function CustosPage({
  searchParams,
}: {
  searchParams: Promise<{ unidade?: string; periodo?: string; setorPrincipal?: string; setorSecundario?: string; mes?: string; colaborador?: string }>;
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

  const { competenceKey: detailCompetenceKey, rows: detailRows } = await getPayrollDetailReport({
    competenceKey: params.mes,
    costCenterId: filters.costCenterId,
    secondaryCostCenterId: filters.secondaryCostCenterId,
    employeeId: params.colaborador,
  });
  const { proventoTotals, descontoTotals } = getPayrollDetailTotals(detailRows);

  const monthLabels = monthLabelsPtBR(lastNMonthsKeys(12));

  const executive = (
    <div className="flex flex-col gap-4">
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
          </div>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <KpiCard label="Salário base" value={formatCurrency(kpis.baseSalaryTotal)} icon={Wallet} accent="navy" tooltip={"Soma do campo Salário Base de todos os lançamentos de folha no período, sem benefícios nem encargos."} />
          <KpiCard label="Benefícios" value={formatCurrency(kpis.benefitsCost)} icon={Wallet} accent="gold" tooltip={"Soma do campo Benefícios de todos os lançamentos de folha no período."} />
          <KpiCard label="Encargos" value={formatCurrency(kpis.chargesCost)} icon={Wallet} accent="danger" tooltip={"Soma do campo Encargos de todos os lançamentos de folha no período (INSS, FGTS e demais encargos sobre a folha)."} />
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
                        Custo total: {formatCurrency(r.totalProventos)}
                      </span>
                    </summary>

                    <div className="grid grid-cols-1 gap-4 border-t border-border p-3 md:grid-cols-2">
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
