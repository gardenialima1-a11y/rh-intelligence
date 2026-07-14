import { resolveScopedFilters } from "@/lib/scope";
import { Users, UserPlus, UserMinus, ArrowLeftRight, Clock3, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { ModuleViewTabs } from "@/components/dashboard/module-view-tabs";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { ForecastChart } from "@/components/dashboard/forecast-chart";
import { RankingBarChart } from "@/components/dashboard/ranking-bar-chart";
import { PyramidChart } from "@/components/dashboard/pyramid-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatPercent, formatDate } from "@/lib/utils";
import { lastNMonthsKeys, monthLabelsPtBR } from "@/services/period";
import { nextMonthLabelsPtBR } from "@/services/forecast";
import { TableCardHeader } from "@/components/dashboard/table-card-header";
import { IdealVsRealTable } from "@/components/dashboard/ideal-vs-real-table";
import {
  getHeadcountKpis,
  getIdealVsRealHeadcount,
  getHeadcountByCostCenter,
  getHeadcountBySecondaryCostCenter,
  getHeadcountByManager,
  getHeadcountForecast,
  getHeadcountPyramid,
  getHeadcountTable,
  getAverageTenureMonths,
} from "@/services/headcount";

export default async function HeadcountPage({
  searchParams,
}: {
  searchParams: Promise<{ unidade?: string; periodo?: string }>;
}) {
  const params = await searchParams;
  const filters = await resolveScopedFilters(params);

  const [kpis, byCostCenter, bySecondaryCostCenter, byManager, forecast, pyramid, table, avgTenure, idealVsReal] = await Promise.all([
    getHeadcountKpis(filters),
    getHeadcountByCostCenter(filters.unitId),
    getHeadcountBySecondaryCostCenter(filters.unitId),
    getHeadcountByManager(filters.unitId),
    getHeadcountForecast(filters),
    getHeadcountPyramid(filters.unitId),
    getHeadcountTable(filters),
    getAverageTenureMonths(filters.unitId),
    getIdealVsRealHeadcount(),
  ]);

  const monthLabels = monthLabelsPtBR(lastNMonthsKeys(12));
  const forecastLabels = nextMonthLabelsPtBR(3);
  const forecastMonthLabels6 = monthLabelsPtBR(lastNMonthsKeys(6));
  const ForecastIcon = forecast.direction === "up" ? TrendingUp : forecast.direction === "down" ? TrendingDown : Minus;

  const executive = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <KpiCard label="Headcount atual" value={formatNumber(kpis.current)} icon={Users} deltaLabel={formatPercent(Math.abs(kpis.delta))} deltaDirection={kpis.delta >= 0 ? "up" : "down"} deltaSentiment={kpis.delta >= 0 ? "positive" : "negative"} sparklineData={kpis.series} accent="navy" />
        <KpiCard label="Admissões no período" value={formatNumber(kpis.admissions)} icon={UserPlus} accent="success" />
        <KpiCard label="Desligamentos no período" value={formatNumber(kpis.terminations)} icon={UserMinus} accent="danger" />
        <KpiCard label="Variação líquida" value={formatNumber(kpis.netChange)} icon={ArrowLeftRight} accent={kpis.netChange >= 0 ? "success" : "danger"} />
        <KpiCard label="Tempo médio de casa" value={`${(avgTenure / 12).toFixed(1)} anos`} icon={Clock3} accent="gold" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Evolução do headcount — 12 meses</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart data={kpis.series} labels={monthLabels} color="#1B2A4A" />
        </CardContent>
      </Card>
    </div>
  );

  const managerial = (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Quadro Ideal x Real — por setor secundário</CardTitle>
        </CardHeader>
        <CardContent>
          <IdealVsRealTable rows={idealVsReal} />
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Headcount por centro de custo</CardTitle>
        </CardHeader>
        <CardContent>
          <RankingBarChart data={byCostCenter} dataKey="headcount" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Headcount por centro de custo secundário</CardTitle>
        </CardHeader>
        <CardContent>
          {bySecondaryCostCenter.length > 0 ? (
            <RankingBarChart data={bySecondaryCostCenter} dataKey="headcount" color="#4C8B5B" />
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum colaborador com setor secundário preenchido.</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Headcount por gestor</CardTitle>
        </CardHeader>
        <CardContent>
          {byManager.length > 0 ? (
            <RankingBarChart data={byManager} dataKey="headcount" color="#B8935A" />
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum gestor com colaboradores ativos no filtro atual.</p>
          )}
        </CardContent>
      </Card>
    </div>
    </div>
  );

  const operational = (
    <Card>
      <TableCardHeader
        title="Colaboradores ativos (top 50 admissões recentes)"
        filename="headcount-colaboradores-ativos"
        data={table.map((e) => ({
          matricula: e.registration,
          nome: e.name,
          cargo: e.position?.name ?? "",
          centro_custo: e.costCenter?.name ?? "",
          gestor: e.manager?.name ?? "",
          unidade: e.unit.name,
          admissao: e.admissionDate,
          contrato: e.contractType,
        }))}
        columns={[
          { key: "matricula", label: "Matrícula" },
          { key: "nome", label: "Nome" },
          { key: "cargo", label: "Cargo" },
          { key: "centro_custo", label: "Centro de Custo" },
          { key: "gestor", label: "Gestor" },
          { key: "unidade", label: "Unidade" },
          { key: "admissao", label: "Admissão" },
          { key: "contrato", label: "Contrato" },
        ]}
      />
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Matrícula</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Centro de Custo</TableHead>
              <TableHead>Gestor</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Admissão</TableHead>
              <TableHead>Contrato</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{e.registration}</TableCell>
                <TableCell>{e.name}</TableCell>
                <TableCell>{e.position?.name ?? "—"}</TableCell>
                <TableCell>{e.costCenter?.name ?? "—"}</TableCell>
                <TableCell>{e.manager?.name ?? "—"}</TableCell>
                <TableCell>{e.unit.name}</TableCell>
                <TableCell>{formatDate(e.admissionDate)}</TableCell>
                <TableCell>
                  <Badge variant="outline">{e.contractType}</Badge>
                </TableCell>
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
        <KpiCard
          label="Projeção em 3 meses"
          value={formatNumber(forecast.projected3Months)}
          icon={ForecastIcon}
          accent={forecast.direction === "up" ? "success" : forecast.direction === "down" ? "danger" : "navy"}
        />
        <KpiCard label="Tendência" value={forecast.direction === "up" ? "Crescimento" : forecast.direction === "down" ? "Redução" : "Estável"} icon={ForecastIcon} accent="gold" />
        <KpiCard label="Headcount atual (base do forecast)" value={formatNumber(kpis.current)} icon={Users} accent="navy" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Workforce Planning — projeção de headcount (próximos 3 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          <ForecastChart
            historicalData={forecast.historicalSeries}
            historicalLabels={forecastMonthLabels6}
            forecastData={forecast.forecastSeries}
            forecastLabels={forecastLabels}
            color="#1B2A4A"
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Projeção calculada por regressão linear sobre os últimos 6 meses. Use como referência direcional para
            planejamento de contratações e orçamento de pessoal — não substitui o planejamento formal de headcount.
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Pirâmide etária e de gênero</CardTitle>
        </CardHeader>
        <CardContent>
          <PyramidChart data={pyramid} />
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader title="Headcount" description="Quadro ativo, previsto e evolução do headcount por unidade, gestor e centro de custo." moduleKey="headcount" />
      <ModuleViewTabs executive={executive} managerial={managerial} operational={operational} analytical={analytical} />
    </div>
  );
}
