import { resolveScopedFilters } from "@/lib/scope";
import { Clock3, Wallet, Gauge, Timer } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { ModuleViewTabs } from "@/components/dashboard/module-view-tabs";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { RankingBarChart } from "@/components/dashboard/ranking-bar-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { formatNumber, formatPercent, formatCurrency, formatDate } from "@/lib/utils";
import { lastNMonthsKeys, monthLabelsPtBR } from "@/services/period";
import { getJornadaKpis, getOvertimeByCostCenter, getOvertimeBySectorBreakdown, getOvertimeRanking, getJornadaTable } from "@/services/jornada";
import { OvertimeBySectorTable } from "@/components/dashboard/overtime-by-sector-table";
import { SectorFilterInline } from "@/components/dashboard/sector-filter-inline";
import { OvertimeImportDialog } from "@/components/admin/overtime-import-dialog";
import { OvertimePdfImportDialog } from "@/components/admin/overtime-pdf-import-dialog";
import { OvertimeManualEntryDialog } from "@/components/admin/overtime-manual-entry-dialog";
import { OvertimeDeleteRangeDialog } from "@/components/admin/overtime-delete-range-dialog";
import { DeleteOvertimeEntryButton } from "@/components/admin/delete-overtime-entry-button";
import { prisma } from "@/lib/prisma";

export default async function JornadaPage({
  searchParams,
}: {
  searchParams: Promise<{ unidade?: string; periodo?: string; setorPrincipal?: string; setorSecundario?: string }>;
}) {
  const params = await searchParams;
  const filters = await resolveScopedFilters(params);

  const [kpis, byCostCenter, sectorBreakdown, ranking, table, sectors, employees] = await Promise.all([
    getJornadaKpis(filters),
    getOvertimeByCostCenter(filters),
    getOvertimeBySectorBreakdown(filters),
    getOvertimeRanking(filters),
    getJornadaTable(filters),
    prisma.costCenter.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const monthLabels = monthLabelsPtBR(lastNMonthsKeys(12));

  const executive = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Horas extras (período)" value={`${formatNumber(kpis.overtimeHours)} h`} icon={Clock3} deltaLabel={formatPercent(Math.abs(kpis.delta))} deltaDirection={kpis.delta >= 0 ? "up" : "down"} deltaSentiment={kpis.delta >= 0 ? "negative" : "positive"} sparklineData={kpis.series} accent="gold" />
        <KpiCard label="Custo de horas extras" value={formatCurrency(kpis.overtimeCost)} icon={Wallet} accent="danger" />
        <KpiCard label="Saldo de banco de horas" value={`${formatNumber(kpis.bankBalance)} h`} icon={Timer} accent="navy" />
        <KpiCard label="Excesso de jornada" value={formatPercent(kpis.excessRate)} icon={Gauge} accent="danger" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Horas extras — 12 meses</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart data={kpis.series} labels={monthLabels} color="#C9922E" />
        </CardContent>
      </Card>
    </div>
  );

  const managerial = (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-col items-start gap-3 space-y-0 md:flex-row md:items-center md:justify-between">
          <CardTitle>Horas extras por setor — horas e custo</CardTitle>
          <SectorFilterInline sectors={sectors} />
        </CardHeader>
        <CardContent>
          <OvertimeBySectorTable rows={sectorBreakdown} />
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Horas extras por centro de custo</CardTitle>
        </CardHeader>
        <CardContent>
          {byCostCenter.length > 0 ? <RankingBarChart data={byCostCenter} color="#C9922E" /> : <p className="text-sm text-muted-foreground">Sem HE no período.</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Ranking de colaboradores (HE)</CardTitle>
        </CardHeader>
        <CardContent>
          {ranking.length > 0 ? <RankingBarChart data={ranking} color="#B23A48" /> : <p className="text-sm text-muted-foreground">Sem HE no período.</p>}
        </CardContent>
      </Card>
      </div>
    </div>
  );

  const operational = (
    <Card>
      <CardHeader className="flex-col items-start gap-3 space-y-0 md:flex-row md:items-center md:justify-between">
        <CardTitle>Lançamentos com horas extras</CardTitle>
        <div className="flex flex-wrap gap-2">
          <OvertimeManualEntryDialog employees={employees} />
          <OvertimePdfImportDialog employees={employees} />
          <OvertimeImportDialog />
          <OvertimeDeleteRangeDialog employees={employees} />
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Horas trabalhadas</TableHead>
              <TableHead>Horas extras</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.employee.name}</TableCell>
                <TableCell>{t.employee.position?.name ?? "—"}</TableCell>
                <TableCell>{t.employee.unit.name}</TableCell>
                <TableCell>{formatDate(t.date)}</TableCell>
                <TableCell>{t.workedHours.toFixed(1)} h</TableCell>
                <TableCell>{t.overtimeHours.toFixed(1)} h</TableCell>
                <TableCell>
                  <DeleteOvertimeEntryButton entryId={t.id} employeeName={t.employee.name} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  const analytical = (
    <Card>
      <CardHeader>
        <CardTitle>Indicadores de risco de jornada</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="Taxa de excesso" value={formatPercent(kpis.excessRate)} icon={Gauge} accent="danger" />
        <KpiCard label="Custo de HE" value={formatCurrency(kpis.overtimeCost)} icon={Wallet} accent="gold" />
        <KpiCard label="Saldo de banco de horas" value={`${formatNumber(kpis.bankBalance)} h`} icon={Timer} accent="navy" />
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader title="Jornada, Ponto e Horas Extras" description="Banco de horas, horas extras e conformidade de jornada." moduleKey="jornada" />
      <ModuleViewTabs executive={executive} managerial={managerial} operational={operational} analytical={analytical} />
    </div>
  );
}
