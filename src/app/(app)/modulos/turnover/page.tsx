import { resolveScopedFilters } from "@/lib/scope";
import { TrendingUp, TrendingDown, Wallet, UserX, Timer, Minus } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { ModuleViewTabs } from "@/components/dashboard/module-view-tabs";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { ForecastChart } from "@/components/dashboard/forecast-chart";
import { RankingBarChart } from "@/components/dashboard/ranking-bar-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatPercent, formatCurrency, formatDate } from "@/lib/utils";
import { lastNMonthsKeys, monthLabelsPtBR } from "@/services/period";
import { nextMonthLabelsPtBR } from "@/services/forecast";
import { TableCardHeader } from "@/components/dashboard/table-card-header";
import { getTurnoverKpis, getTurnoverByManager, getTurnoverByReason, getEarlyTurnover, getTurnoverTable, getTurnoverForecast } from "@/services/turnover";

export default async function TurnoverPage({
  searchParams,
}: {
  searchParams: Promise<{ unidade?: string; periodo?: string }>;
}) {
  const params = await searchParams;
  const filters = await resolveScopedFilters(params);

  const [kpis, byManager, byReason, early, table, forecast] = await Promise.all([
    getTurnoverKpis(filters),
    getTurnoverByManager(filters),
    getTurnoverByReason(filters),
    getEarlyTurnover(filters),
    getTurnoverTable(filters),
    getTurnoverForecast(filters),
  ]);

  const monthLabels = monthLabelsPtBR(lastNMonthsKeys(12));
  const forecastMonthLabels6 = monthLabelsPtBR(lastNMonthsKeys(6));
  const forecastLabels = nextMonthLabelsPtBR(3);
  const ForecastIcon = forecast.direction === "up" ? TrendingUp : forecast.direction === "down" ? TrendingDown : Minus;

  const executive = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <KpiCard label="Turnover geral" value={formatPercent(kpis.current.rate)} icon={TrendingUp} deltaLabel={formatPercent(Math.abs(kpis.delta))} deltaDirection={kpis.delta >= 0 ? "up" : "down"} deltaSentiment={kpis.delta >= 0 ? "negative" : "positive"} sparklineData={kpis.series} accent="danger" tooltip={"Total de desligamentos no período dividido pelo headcount médio do mesmo período (média entre início e fim). Inclui voluntários e involuntários."} />
        <KpiCard label="Turnover voluntário" value={formatPercent(kpis.current.voluntaryRate)} icon={TrendingDown} accent="gold" tooltip={"Desligamentos marcados como Voluntário (pedido do colaborador) no período, divididos pelo headcount médio do mesmo período."} />
        <KpiCard label="Turnover involuntário" value={formatPercent(kpis.current.involuntaryRate)} icon={UserX} accent="navy" tooltip={"Desligamentos marcados como Involuntário (decisão da empresa) no período, divididos pelo headcount médio do mesmo período."} />
        <KpiCard label="Custo de turnover" value={formatCurrency(kpis.totalCost)} icon={Wallet} accent="danger" tooltip={"Soma do campo Custo de todos os desligamentos do período (valor preenchido manualmente no cadastro de cada desligamento)."} />
        <KpiCard label="Turnover 1º ano" value={formatPercent(early.withinYearRate)} icon={Timer} accent="gold" tooltip={"Entre os desligados no período, o percentual que saiu com até 365 dias de casa (data de desligamento - data de admissão)."} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Turnover — tendência (12 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart data={kpis.series.map((v) => v * 100)} labels={monthLabels} color="#B23A48" format="percent1" />
        </CardContent>
      </Card>
    </div>
  );

  const managerial = (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Desligamentos por gestor</CardTitle>
        </CardHeader>
        <CardContent>
          {byManager.length > 0 ? <RankingBarChart data={byManager} /> : <p className="text-sm text-muted-foreground">Sem desligamentos no período.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Top motivos de saída</CardTitle>
        </CardHeader>
        <CardContent>
          {byReason.length > 0 ? <RankingBarChart data={byReason} color="#B8935A" /> : <p className="text-sm text-muted-foreground">Sem dados no período.</p>}
        </CardContent>
      </Card>
    </div>
  );

  const operational = (
    <Card>
      <TableCardHeader
        title="Desligamentos no período"
        filename="turnover-desligamentos"
        data={table.map((m) => ({
          colaborador: m.employee.name,
          cargo: m.employee.position?.name ?? "",
          gestor: m.employee.manager?.name ?? "",
          unidade: m.employee.unit.name,
          data: m.date,
          tipo: m.voluntary ? "Voluntário" : "Involuntário",
          motivo: m.reason?.label ?? "",
          custo: m.costValue ?? "",
        }))}
        columns={[
          { key: "colaborador", label: "Colaborador" },
          { key: "cargo", label: "Cargo" },
          { key: "gestor", label: "Gestor" },
          { key: "unidade", label: "Unidade" },
          { key: "data", label: "Data" },
          { key: "tipo", label: "Tipo" },
          { key: "motivo", label: "Motivo" },
          { key: "custo", label: "Custo" },
        ]}
      />
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Gestor</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Custo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.map((m) => (
              <TableRow key={m.id}>
                <TableCell>{m.employee.name}</TableCell>
                <TableCell>{m.employee.position?.name ?? "—"}</TableCell>
                <TableCell>{m.employee.manager?.name ?? "—"}</TableCell>
                <TableCell>{m.employee.unit.name}</TableCell>
                <TableCell>{formatDate(m.date)}</TableCell>
                <TableCell>
                  <Badge variant={m.voluntary ? "warning" : "danger"}>{m.voluntary ? "Voluntário" : "Involuntário"}</Badge>
                </TableCell>
                <TableCell>{m.reason?.label ?? "—"}</TableCell>
                <TableCell>{m.costValue ? formatCurrency(m.costValue) : "—"}</TableCell>
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
        <KpiCard label="Desligamentos primeiros 90 dias" value={String(early.within90)} icon={Timer} accent="danger" tooltip={"Quantidade de desligados no período que saíram com até 90 dias de casa (data de desligamento - data de admissão)."} />
        <KpiCard label="Desligamentos no 1º ano" value={String(early.withinYear)} icon={Timer} accent="gold" tooltip={"Quantidade de desligados no período que saíram com até 365 dias de casa."} />
        <KpiCard label="Total de desligamentos analisados" value={String(early.total)} icon={UserX} accent="navy" tooltip={"Total de colaboradores desligados no período, usado como base para calcular os percentuais de turnover precoce (90 dias e 1º ano)."} />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard
          label="Turnover projetado (3 meses)"
          value={formatPercent(forecast.projectedRate3Months)}
          icon={ForecastIcon}
          accent={forecast.direction === "up" ? "danger" : forecast.direction === "down" ? "success" : "navy"}
        tooltip={"Taxa de turnover estimada para os próximos 3 meses, calculada por regressão linear sobre a série histórica dos últimos 6 meses. É uma projeção estatística, não uma meta."}
      />
        <KpiCard label="Tendência" value={forecast.direction === "up" ? "Piora" : forecast.direction === "down" ? "Melhora" : "Estável"} icon={ForecastIcon} accent="gold" tooltip={"Direção da projeção de turnover (piora, melhora ou estável), com base na mesma regressão linear dos últimos 6 meses."} />
        <KpiCard label="Turnover atual (base do forecast)" value={formatPercent(kpis.current.rate)} icon={TrendingUp} accent="navy" tooltip={"Taxa de turnover do período atual, usada como ponto de partida da projeção de 3 meses."} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Projeção de turnover (próximos 3 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          <ForecastChart
            historicalData={forecast.historicalSeries}
            historicalLabels={forecastMonthLabels6}
            forecastData={forecast.forecastSeries}
            forecastLabels={forecastLabels}
            color="#B23A48"
            format="percent1"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Projeção calculada por regressão linear sobre os últimos 6 meses — apoia o planejamento de retenção e
            dimensionamento antecipado de recrutamento.
          </p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader title="Turnover" description="Rotatividade voluntária e involuntária, segmentada por gestor, motivo e tempo de casa." moduleKey="turnover" />
      <ModuleViewTabs executive={executive} managerial={managerial} operational={operational} analytical={analytical} />
    </div>
  );
}
