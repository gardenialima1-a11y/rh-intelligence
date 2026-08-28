import { resolveScopedFilters } from "@/lib/scope";
import { AlertTriangle, Clock3, Wallet, ListChecks, Gauge, Stethoscope, ShieldCheck } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { ModuleViewTabs } from "@/components/dashboard/module-view-tabs";
import { KpiCard } from "@/components/dashboard/kpi-card";

// Relatórios de ponto costumam ter milhares de linhas (um mês inteiro × todos os
// colaboradores) — a importação precisa de mais que o limite padrão de 10s da Vercel.
export const maxDuration = 60;
import { AbsenteeismTrendChart } from "@/components/dashboard/absenteeism-trend-chart";
import { AbsenteeismStrategicAnalysis } from "@/components/dashboard/absenteeism-strategic-analysis";
import { OcorrenciasFilterBar } from "@/components/dashboard/ocorrencias-filter-bar";
import { CustoCruzadoFilterBar } from "@/components/dashboard/custo-cruzado-filter-bar";
import { RankingBarChart } from "@/components/dashboard/ranking-bar-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatPercent, formatCurrency, formatDate } from "@/lib/utils";
import { monthLabelsPtBR } from "@/services/period";
import { TableCardHeader } from "@/components/dashboard/table-card-header";
import { AttendanceImportDialog } from "@/components/admin/attendance-import-dialog";
import {
  getAbsenteismoKpis,
  getAbsenceByReason,
  getAbsenceByCostCenter,
  getAbsenceTable,
  getBradfordFactorRanking,
  getOcorrenciasDetalhadas,
  resumoOcorrenciasPorMes,
  resumoOcorrenciasPorSetor,
  getAbsenteismoMonthlyBreakdown,
} from "@/services/absenteismo";
import {
  getCustoRealAtestados,
  resumoCustoAtestadoPorPessoa,
  resumoCustoAtestadoPorSetor,
  resumoCustoAtestadoPorMes,
  getFaltasInjustificadasCruzadas,
  resumoFaltasCruzadasPorPessoa,
  resumoFaltasCruzadasPorSetor,
  resumoFaltasCruzadasPorMes,
} from "@/services/absenteismo-custo-real";

const FALTA_STATUS_VARIANT: Record<string, "danger" | "success" | "outline"> = {
  CONFIRMADA: "danger",
  ABONADA: "success",
  INDETERMINADA: "outline",
};
const FALTA_STATUS_LABEL: Record<string, string> = {
  CONFIRMADA: "Confirmada (com desconto)",
  ABONADA: "Abonada (sem desconto)",
  INDETERMINADA: "Indeterminada (sem folha detalhada)",
};

function monthLabelPtBR(key: string): string {
  return monthLabelsPtBR([key])[0];
}

const BRADFORD_VARIANT: Record<string, "danger" | "warning" | "outline"> = {
  Crítico: "danger",
  Atenção: "warning",
  Normal: "outline",
};

export default async function AbsenteismoPage({
  searchParams,
}: {
  searchParams: Promise<{
    unidade?: string;
    periodo?: string;
    mes?: string;
    busca?: string;
    atestadoMes?: string;
    atestadoBusca?: string;
    faltaMes?: string;
    faltaBusca?: string;
    faltaStatus?: string;
  }>;
}) {
  const params = await searchParams;
  // Padrão deste módulo é o ano de 2026 — a pessoa ainda pode trocar pelo filtro
  // global de período (unidade/setor/período) no topo da tela, se quiser ver outro recorte.
  const filters = await resolveScopedFilters({ ...params, periodo: params.periodo ?? "2026" });

  const [kpis, byReason, byCostCenter, table, bradford, ocorrencias, monthlyBreakdown, custoAtestadoRows, faltaCruzadaRows] =
    await Promise.all([
      getAbsenteismoKpis(filters),
      getAbsenceByReason(filters),
      getAbsenceByCostCenter(filters),
      getAbsenceTable(filters),
      getBradfordFactorRanking(filters),
      getOcorrenciasDetalhadas(filters),
      getAbsenteismoMonthlyBreakdown(filters),
      getCustoRealAtestados(filters),
      getFaltasInjustificadasCruzadas(filters),
    ]);

  const resumoMensal = resumoOcorrenciasPorMes(ocorrencias);
  const resumoSetorPrincipal = resumoOcorrenciasPorSetor(ocorrencias, "setorPrincipal");
  const resumoSetorSecundario = resumoOcorrenciasPorSetor(ocorrencias, "setorSecundario");

  // Filtro de mês/nome (via URL, aplicado só na lista detalhada — os resumos acima
  // sempre mostram o período inteiro pra dar a visão geral).
  const buscaNormalizada = (params.busca ?? "").trim().toLowerCase();
  let ocorrenciasFiltradas = ocorrencias;
  if (params.mes) ocorrenciasFiltradas = ocorrenciasFiltradas.filter((o) => o.mesKey === params.mes);
  if (buscaNormalizada) ocorrenciasFiltradas = ocorrenciasFiltradas.filter((o) => o.employeeName.toLowerCase().includes(buscaNormalizada));

  // --- Custo real de atestados: cruzamento com a folha (salário real do mês, quando existir) ---
  const custoAtestadoTotal = custoAtestadoRows.reduce((s, r) => s + r.cost, 0);
  const custoAtestadoUsaAproximacao = custoAtestadoRows.some((r) => r.rateSource !== "FOLHA_REAL");
  const custoAtestadoMeses = resumoCustoAtestadoPorMes(custoAtestadoRows).map((m) => ({ value: m.mesKey, label: m.label }));

  const atestadoBuscaNormalizada = (params.atestadoBusca ?? "").trim().toLowerCase();
  let custoAtestadoRowsFiltradas = custoAtestadoRows;
  if (params.atestadoMes) custoAtestadoRowsFiltradas = custoAtestadoRowsFiltradas.filter((r) => r.mesKey === params.atestadoMes);
  if (atestadoBuscaNormalizada)
    custoAtestadoRowsFiltradas = custoAtestadoRowsFiltradas.filter((r) => r.employeeName.toLowerCase().includes(atestadoBuscaNormalizada));

  const custoAtestadoPorPessoa = resumoCustoAtestadoPorPessoa(custoAtestadoRowsFiltradas);
  const custoAtestadoPorSetor = resumoCustoAtestadoPorSetor(custoAtestadoRows, "costCenterName").map((s) => ({
    name: s.setor,
    value: Math.round(s.cost),
  }));
  const TAMANHO_PAGINA_ATESTADO = 300;
  const custoAtestadoExibidas = custoAtestadoRowsFiltradas.slice(0, TAMANHO_PAGINA_ATESTADO);

  // --- Faltas injustificadas cruzadas com desconto na folha ---
  const faltaTotais = faltaCruzadaRows.reduce(
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
  const faltaMeses = resumoFaltasCruzadasPorMes(faltaCruzadaRows).map((m) => ({ value: m.key, label: m.label }));

  const faltaBuscaNormalizada = (params.faltaBusca ?? "").trim().toLowerCase();
  let faltaCruzadaRowsFiltradas = faltaCruzadaRows;
  if (params.faltaMes) faltaCruzadaRowsFiltradas = faltaCruzadaRowsFiltradas.filter((r) => r.mesKey === params.faltaMes);
  if (params.faltaStatus) faltaCruzadaRowsFiltradas = faltaCruzadaRowsFiltradas.filter((r) => r.status === params.faltaStatus);
  if (faltaBuscaNormalizada)
    faltaCruzadaRowsFiltradas = faltaCruzadaRowsFiltradas.filter((r) => r.employeeName.toLowerCase().includes(faltaBuscaNormalizada));
  faltaCruzadaRowsFiltradas = [...faltaCruzadaRowsFiltradas].sort((a, b) => b.mesKey.localeCompare(a.mesKey));

  const faltaPorSetor = resumoFaltasCruzadasPorSetor(faltaCruzadaRows, "costCenterName");
  const faltaPorPessoa = resumoFaltasCruzadasPorPessoa(faltaCruzadaRows);
  const TAMANHO_PAGINA = 300;
  const ocorrenciasExibidas = ocorrenciasFiltradas.slice(0, TAMANHO_PAGINA);

  const criticalBradford = bradford.filter((b) => b.riskLevel === "Crítico");
  const trendTitle = filters.period && /^\d{4}$/.test(filters.period) ? `Absenteísmo — ${filters.period}` : "Absenteísmo — 12 meses";

  const executive = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Taxa de absenteísmo" value={formatPercent(kpis.rate)} icon={AlertTriangle} deltaLabel={formatPercent(Math.abs(kpis.delta))} deltaDirection={kpis.delta >= 0 ? "up" : "down"} deltaSentiment={kpis.delta >= 0 ? "negative" : "positive"} sparklineData={kpis.series} accent="gold" tooltip={"Soma de horas perdidas por faltas/atestados dividida pela soma de horas programadas de trabalho (jornada) no período. Considera apenas ocorrências que \"entram no cálculo\" (exclui férias, folga, feriado, sem jornada, cargo de confiança, abono, dispensa e curso/aprendizagem)."} />
        <KpiCard label="Horas perdidas" value={`${formatNumber(kpis.hoursLost)} h`} icon={Clock3} accent="danger" tooltip={"Soma de todas as horas de ausência registradas no período (que entram no cálculo de absenteísmo), vindas da importação do relatório de ponto ou lançamento manual."} />
        <KpiCard label="Ocorrências" value={formatNumber(kpis.occurrences)} icon={ListChecks} accent="navy" tooltip={"Quantidade total de dias de ausência registrados no período que entram no cálculo de absenteísmo (uma linha de ausência = uma ocorrência)."} />
        <KpiCard
          label="Custo estimado"
          value={formatCurrency(kpis.estimatedCost)}
          icon={Wallet}
          accent="danger"
          tooltip={`Calculado a partir da faixa salarial do cargo de cada colaborador (piso/teto), convertida em valor-hora por uma jornada de 220h/mês. Cobre TODAS as ausências (atestado e falta). ${
            kpis.estimatedCostCoverage < 0.95
              ? `${Math.round((1 - kpis.estimatedCostCoverage) * 100)}% das horas usaram uma média salarial de aproximação, por falta de cargo/faixa cadastrada para o colaborador — vale revisar o cadastro de cargos para deixar esse número mais preciso.`
              : "A maior parte das horas usou a faixa salarial real do cargo do colaborador."
          } Veja ao lado o custo real cruzado com a folha, específico de atestados.`}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <KpiCard
          label="Custo real de atestados (cruzado com a folha)"
          value={formatCurrency(custoAtestadoTotal)}
          icon={Stethoscope}
          accent="danger"
          tooltip={`Quanto a empresa pagou de salário durante os dias de atestado médico no período — usa o salário REAL lançado na folha daquele mês sempre que existir (mais preciso que a faixa do cargo). ${
            custoAtestadoUsaAproximacao
              ? "Parte dos valores ainda usa a faixa salarial do cargo (ou a média das faixas) por falta de folha detalhada importada naquele mês para aquele colaborador."
              : "Todos os valores usaram o salário real da folha."
          } Por lei, os primeiros 15 dias de atestado são pagos pela empresa (a partir do 16º dia o INSS assume via auxílio-doença) — por isso não vira desconto na folha, mas é custo real do período.`}
        />
        <KpiCard
          label="Faltas injustificadas confirmadas"
          value={formatNumber(faltaTotais.confirmadas)}
          icon={ShieldCheck}
          accent="danger"
          tooltip={`Faltas (status "Faltou" no ponto) que TÊM desconto correspondente na folha daquele mês — custo real de ${formatCurrency(
            faltaTotais.custoConfirmado
          )} em descontos. Ficaram de fora ${formatNumber(faltaTotais.abonadas)} falta(s) sem desconto na folha (provavelmente acordada com o gestor) e ${formatNumber(
            faltaTotais.indeterminadas
          )} sem folha detalhada importada naquele mês para confirmar. Veja o detalhamento na aba Operacional.`}
        />
      </div>
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>{trendTitle}</CardTitle>
          <AbsenteeismStrategicAnalysis data={monthlyBreakdown} />
        </CardHeader>
        <CardContent>
          <AbsenteeismTrendChart data={monthlyBreakdown} color="#C9922E" />
          <p className="mt-2 text-xs text-muted-foreground">
            Passe o mouse sobre um mês pra ver o mix atestado x falta não justificada, o setor secundário mais
            impactado e o motivo mais frequente. Meses com um ponto destacado ficaram acima da média do período.
          </p>
        </CardContent>
      </Card>
    </div>
  );

  const managerial = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Horas perdidas por centro de custo</CardTitle>
          </CardHeader>
          <CardContent>
            {byCostCenter.length > 0 ? <RankingBarChart data={byCostCenter} color="#C9922E" /> : <p className="text-sm text-muted-foreground">Sem ocorrências no período.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Horas perdidas por motivo</CardTitle>
          </CardHeader>
          <CardContent>
            {byReason.length > 0 ? <RankingBarChart data={byReason} color="#B23A48" /> : <p className="text-sm text-muted-foreground">Sem ocorrências no período.</p>}
          </CardContent>
        </Card>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Custo real de atestados por setor</CardTitle>
          </CardHeader>
          <CardContent>
            {custoAtestadoPorSetor.length > 0 ? (
              <RankingBarChart data={custoAtestadoPorSetor} color="#4C8B5B" />
            ) : (
              <p className="text-sm text-muted-foreground">Sem atestados no período.</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Custo calculado com o salário real da folha do mês, quando disponível; senão usa a faixa salarial do
              cargo como aproximação.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Faltas injustificadas por setor — confirmadas x abonadas</CardTitle>
          </CardHeader>
          <CardContent>
            {faltaPorSetor.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem faltas registradas no período.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Setor</TableHead>
                    <TableHead>Confirmadas</TableHead>
                    <TableHead>Abonadas</TableHead>
                    <TableHead>Indeterminadas</TableHead>
                    <TableHead>Custo confirmado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {faltaPorSetor.map((s) => (
                    <TableRow key={s.key}>
                      <TableCell>{s.label}</TableCell>
                      <TableCell><Badge variant="danger">{s.ocorrenciasConfirmadas}</Badge></TableCell>
                      <TableCell><Badge variant="success">{s.ocorrenciasAbonadas}</Badge></TableCell>
                      <TableCell><Badge variant="outline">{s.ocorrenciasIndeterminadas}</Badge></TableCell>
                      <TableCell>{formatCurrency(s.custoConfirmado)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              &quot;Confirmadas&quot; têm desconto correspondente na folha daquele mês. &quot;Abonadas&quot; não têm
              desconto (podem ter sido acordadas com o gestor) e não entram como custo. &quot;Indeterminadas&quot; não
              têm folha detalhada importada naquele mês pra confirmar.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const operational = (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div className="flex flex-col gap-1">
            <CardTitle>Ocorrências por mês</CardTitle>
            <p className="text-xs text-muted-foreground">
              Todo dia de ausência detectado pelo ponto, dizendo se entra no cálculo de absenteísmo e se tem
              atestado — atualizado automaticamente a cada importação.
            </p>
          </div>
          <AttendanceImportDialog />
        </CardHeader>
        <CardContent>
          {resumoMensal.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum relatório de ponto importado ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mês</TableHead>
                  <TableHead>Total de ocorrências</TableHead>
                  <TableHead>Entram no cálculo</TableHead>
                  <TableHead>Com atestado</TableHead>
                  <TableHead>Sem atestado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {resumoMensal.map((m) => (
                  <TableRow key={m.mes}>
                    <TableCell className="font-medium capitalize">{m.label}</TableCell>
                    <TableCell>{m.total}</TableCell>
                    <TableCell>{m.contamCalculo}</TableCell>
                    <TableCell><Badge variant="success">{m.comAtestado}</Badge></TableCell>
                    <TableCell><Badge variant="danger">{m.semAtestado}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            &quot;Entram no cálculo&quot; exclui férias, folga, feriado, sem jornada, cargo de confiança, abono e
            dispensa — esses dias não contam como absenteísmo. Curso/Aprendizagem também não aparece como falta,
            mas conta como jornada cumprida.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ocorrências por setor principal</CardTitle>
          </CardHeader>
          <CardContent>
            {resumoSetorPrincipal.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma ocorrência no período.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Setor</TableHead>
                    <TableHead>Ocorrências</TableHead>
                    <TableHead>Com atestado</TableHead>
                    <TableHead>Sem atestado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resumoSetorPrincipal.map((r) => (
                    <TableRow key={r.setor}>
                      <TableCell>{r.setor}</TableCell>
                      <TableCell>{r.total}</TableCell>
                      <TableCell><Badge variant="success">{r.comAtestado}</Badge></TableCell>
                      <TableCell><Badge variant="danger">{r.semAtestado}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ocorrências por setor secundário</CardTitle>
          </CardHeader>
          <CardContent>
            {resumoSetorSecundario.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma ocorrência com setor secundário identificado.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Setor</TableHead>
                    <TableHead>Ocorrências</TableHead>
                    <TableHead>Com atestado</TableHead>
                    <TableHead>Sem atestado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resumoSetorSecundario.map((r) => (
                    <TableRow key={r.setor}>
                      <TableCell>{r.setor}</TableCell>
                      <TableCell>{r.total}</TableCell>
                      <TableCell><Badge variant="success">{r.comAtestado}</Badge></TableCell>
                      <TableCell><Badge variant="danger">{r.semAtestado}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card id="ocorrencias">
        <CardHeader className="flex-col items-start gap-3 space-y-0 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle>Ocorrências detalhadas</CardTitle>
            <p className="text-xs text-muted-foreground">
              {ocorrenciasFiltradas.length} ocorrência(s) encontrada(s)
              {ocorrenciasFiltradas.length > TAMANHO_PAGINA ? ` — mostrando as ${TAMANHO_PAGINA} mais recentes` : ""}.
            </p>
          </div>
          <OcorrenciasFilterBar months={resumoMensal.map((m) => ({ value: m.mes, label: m.label }))} />
        </CardHeader>
        <CardContent>
          {ocorrenciasExibidas.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma ocorrência encontrada com esse filtro.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Setor principal</TableHead>
                  <TableHead>Setor secundário</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Entra no cálculo</TableHead>
                  <TableHead>Atestado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ocorrenciasExibidas.map((o, i) => (
                  <TableRow key={i}>
                    <TableCell>{formatDate(o.date)}</TableCell>
                    <TableCell>{o.employeeName}</TableCell>
                    <TableCell>{o.setorPrincipal ?? "—"}</TableCell>
                    <TableCell>{o.setorSecundario ?? "—"}</TableCell>
                    <TableCell>{o.motivoLabel}</TableCell>
                    <TableCell>
                      {o.entraNoCalculo ? <Badge variant="warning">Sim</Badge> : <Badge variant="outline">Não</Badge>}
                    </TableCell>
                    <TableCell>
                      {!o.entraNoCalculo ? (
                        <span className="text-muted-foreground">—</span>
                      ) : o.hasCertificate ? (
                        <Badge variant="success">Sim</Badge>
                      ) : (
                        <Badge variant="danger">Não</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
      <TableCardHeader
        title="Ocorrências de afastamento"
        filename="absenteismo-ocorrencias"
        data={table.map((a) => ({
          colaborador: a.employee.name,
          unidade: a.employee.unit.name,
          data: a.date,
          motivo: a.reason?.label ?? "",
          cid: a.cid ?? "",
          horas_perdidas: a.hoursLost,
          atestado: a.hasCertificate ? "Sim" : "Não",
        }))}
        columns={[
          { key: "colaborador", label: "Colaborador" },
          { key: "unidade", label: "Unidade" },
          { key: "data", label: "Data" },
          { key: "motivo", label: "Motivo" },
          { key: "cid", label: "CID" },
          { key: "horas_perdidas", label: "Horas perdidas" },
          { key: "atestado", label: "Atestado" },
        ]}
      />
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>CID</TableHead>
              <TableHead>Horas perdidas</TableHead>
              <TableHead>Atestado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{a.employee.name}</TableCell>
                <TableCell>{a.employee.unit.name}</TableCell>
                <TableCell>{formatDate(a.date)}</TableCell>
                <TableCell>{a.reason?.label ?? "—"}</TableCell>
                <TableCell>{a.cid ?? "—"}</TableCell>
                <TableCell>{a.hoursLost} h</TableCell>
                <TableCell>{a.hasCertificate ? <Badge variant="success">Sim</Badge> : <Badge variant="outline">Não</Badge>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      </Card>

      <Card id="custo-atestados">
        <CardHeader className="flex-col items-start gap-3 space-y-0 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle>Custo real de atestados — cruzado com a folha</CardTitle>
            <p className="text-xs text-muted-foreground">
              {custoAtestadoRowsFiltradas.length} ocorrência(s) de atestado
              {custoAtestadoRowsFiltradas.length > TAMANHO_PAGINA_ATESTADO ? ` — mostrando as ${TAMANHO_PAGINA_ATESTADO} mais recentes` : ""}
              . Custo de cada atestado = horas perdidas × valor-hora (salário real da folha daquele mês quando existir).
            </p>
          </div>
          <CustoCruzadoFilterBar paramPrefix="atestado" months={custoAtestadoMeses} anchorId="custo-atestados" />
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {custoAtestadoExibidas.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum atestado encontrado com esse filtro.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>CID</TableHead>
                  <TableHead>Horas</TableHead>
                  <TableHead>Valor-hora</TableHead>
                  <TableHead>Fonte</TableHead>
                  <TableHead>Custo do atestado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {custoAtestadoExibidas.map((r) => (
                  <TableRow key={r.absenceId}>
                    <TableCell>{formatDate(r.date)}</TableCell>
                    <TableCell>{r.employeeName}</TableCell>
                    <TableCell>{r.costCenterName ?? "—"}</TableCell>
                    <TableCell>{r.cid ?? "—"}</TableCell>
                    <TableCell>{r.hoursLost} h</TableCell>
                    <TableCell>{formatCurrency(r.hourlyRate)}</TableCell>
                    <TableCell>
                      {r.rateSource === "FOLHA_REAL" ? (
                        <Badge variant="success">Folha real</Badge>
                      ) : r.rateSource === "FAIXA_CARGO" ? (
                        <Badge variant="warning">Faixa do cargo</Badge>
                      ) : (
                        <Badge variant="outline">Média (aprox.)</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{formatCurrency(r.cost)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div>
            <p className="mb-2 text-sm font-medium">Total por colaborador (com o filtro acima aplicado)</p>
            {custoAtestadoPorPessoa.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados para este filtro.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Ocorrências</TableHead>
                    <TableHead>Horas</TableHead>
                    <TableHead>Custo total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {custoAtestadoPorPessoa.map((p) => (
                    <TableRow key={p.employeeId}>
                      <TableCell>{p.employeeName}</TableCell>
                      <TableCell>{p.setor ?? "—"}</TableCell>
                      <TableCell>{p.ocorrencias}</TableCell>
                      <TableCell>{formatNumber(p.hoursLost)} h</TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(p.cost)}
                        {p.usaAproximacao && (
                          <span className="ml-1 text-[10px] text-muted-foreground" title="Parte do valor usou faixa do cargo ou média, por falta de folha real daquele mês.">
                            *
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>

      <Card id="faltas-cruzadas">
        <CardHeader className="flex-col items-start gap-3 space-y-0 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle>Faltas injustificadas — cruzamento com desconto na folha</CardTitle>
            <p className="text-xs text-muted-foreground">
              Uma falta só é considerada &quot;injustificada confirmada&quot; quando há desconto correspondente na
              folha daquele mês. Sem desconto (folha com detalhamento disponível), a falta é tratada como
              &quot;abonada&quot; — pode ter sido negociada com o gestor — e sai da conta de custo/penalização.
            </p>
          </div>
          <CustoCruzadoFilterBar
            paramPrefix="falta"
            months={faltaMeses}
            anchorId="faltas-cruzadas"
            statusOptions={[
              { value: "CONFIRMADA", label: "Confirmada" },
              { value: "ABONADA", label: "Abonada" },
              { value: "INDETERMINADA", label: "Indeterminada" },
            ]}
          />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Confirmadas (com desconto)</p>
              <p className="text-lg font-semibold text-danger">{formatNumber(faltaTotais.confirmadas)}</p>
              <p className="text-xs text-muted-foreground">{formatCurrency(faltaTotais.custoConfirmado)} descontados</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Abonadas (sem desconto)</p>
              <p className="text-lg font-semibold text-success">{formatNumber(faltaTotais.abonadas)}</p>
              <p className="text-xs text-muted-foreground">Removidas da conta de injustificadas</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Indeterminadas</p>
              <p className="text-lg font-semibold">{formatNumber(faltaTotais.indeterminadas)}</p>
              <p className="text-xs text-muted-foreground">Sem folha detalhada importada no mês</p>
            </div>
          </div>

          {faltaCruzadaRowsFiltradas.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma falta encontrada com esse filtro.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Mês</TableHead>
                  <TableHead>Dias de falta</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Valor descontado</TableHead>
                  <TableHead>Verba na folha</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {faltaCruzadaRowsFiltradas.map((r) => (
                  <TableRow key={`${r.employeeId}_${r.mesKey}`}>
                    <TableCell>{r.employeeName}</TableCell>
                    <TableCell>{r.costCenterName ?? "—"}</TableCell>
                    <TableCell className="capitalize">{monthLabelPtBR(r.mesKey)}</TableCell>
                    <TableCell>{r.ocorrencias}</TableCell>
                    <TableCell>
                      <Badge variant={FALTA_STATUS_VARIANT[r.status]}>{FALTA_STATUS_LABEL[r.status]}</Badge>
                    </TableCell>
                    <TableCell>{r.valorDescontado != null ? formatCurrency(r.valorDescontado) : "—"}</TableCell>
                    <TableCell className="max-w-[220px] truncate" title={r.motivoDesconto ?? undefined}>
                      {r.motivoDesconto ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div>
            <p className="mb-2 text-sm font-medium">Ranking de faltas confirmadas por colaborador (período inteiro)</p>
            {faltaPorPessoa.filter((p) => p.ocorrenciasConfirmadas > 0).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma falta confirmada (com desconto) no período.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead>Confirmadas</TableHead>
                    <TableHead>Abonadas</TableHead>
                    <TableHead>Custo confirmado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {faltaPorPessoa
                    .filter((p) => p.ocorrenciasConfirmadas > 0)
                    .slice(0, 20)
                    .map((p) => (
                      <TableRow key={p.key}>
                        <TableCell>{p.label}</TableCell>
                        <TableCell>{p.setor ?? "—"}</TableCell>
                        <TableCell><Badge variant="danger">{p.ocorrenciasConfirmadas}</Badge></TableCell>
                        <TableCell><Badge variant="success">{p.ocorrenciasAbonadas}</Badge></TableCell>
                        <TableCell className="font-medium">{formatCurrency(p.custoConfirmado)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const analytical = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="Taxa de absenteísmo" value={formatPercent(kpis.rate)} icon={AlertTriangle} accent="gold" tooltip={"Soma de horas perdidas por faltas/atestados dividida pela soma de horas programadas de trabalho (jornada) no período. Considera apenas ocorrências que \"entram no cálculo\" (exclui férias, folga, feriado, sem jornada, cargo de confiança, abono, dispensa e curso/aprendizagem)."} />
        <KpiCard
          label="Custo estimado"
          value={formatCurrency(kpis.estimatedCost)}
          icon={Wallet}
          accent="danger"
          tooltip="Calculado a partir da faixa salarial do cargo de cada colaborador (piso/teto), convertida em valor-hora por uma jornada de 220h/mês, multiplicada pelas horas perdidas."
        />
        <KpiCard label="Colaboradores em nível crítico (Bradford)" value={formatNumber(criticalBradford.length)} icon={Gauge} accent="danger" tooltip={"Colaboradores cujo Bradford Score (ocorrências² × dias perdidos) ficou em 450 pontos ou mais — padrão de faltas curtas e frequentes, que costuma pesar mais do que um único afastamento longo."} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Bradford Factor — padrão de fragmentação das faltas</CardTitle>
        </CardHeader>
        <CardContent>
          {bradford.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Sem ocorrências no período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Colaborador</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Ocorrências</TableHead>
                  <TableHead>Dias perdidos</TableHead>
                  <TableHead>Bradford Score</TableHead>
                  <TableHead>Nível</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bradford.slice(0, 20).map((b) => (
                  <TableRow key={b.employeeId}>
                    <TableCell>{b.name}</TableCell>
                    <TableCell>{b.unit}</TableCell>
                    <TableCell>{b.occurrences}</TableCell>
                    <TableCell>{b.totalDays}</TableCell>
                    <TableCell>{b.bradfordScore}</TableCell>
                    <TableCell>
                      <Badge variant={BRADFORD_VARIANT[b.riskLevel]}>{b.riskLevel}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Bradford Factor = ocorrências² × dias perdidos. Penaliza mais fortemente faltas curtas e frequentes do que
            um único afastamento longo com o mesmo total de dias. Faixas de referência: abaixo de 50 (normal), 50–449
            (atenção), 450 ou mais (crítico — recomenda-se conversa estruturada com o colaborador).
          </p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader title="Absenteísmo e Afastamentos" description="Faltas, atestados e afastamentos, com análise de custo e causas." moduleKey="absenteismo" />
      <ModuleViewTabs executive={executive} managerial={managerial} operational={operational} analytical={analytical} />
    </div>
  );
}
