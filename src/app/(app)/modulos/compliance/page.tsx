import { resolveScopedFilters } from "@/lib/scope";
import { FileText, AlertOctagon, Gavel, Wallet } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { ModuleViewTabs } from "@/components/dashboard/module-view-tabs";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { RankingBarChart } from "@/components/dashboard/ranking-bar-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatCurrency, formatDate } from "@/lib/utils";
import { COMPLIANCE_TYPE_LABEL } from "@/lib/labels";
import { getComplianceKpis, getComplianceByReason, getComplianceTable } from "@/services/compliance";
import { ComplianceFormDialog } from "@/components/admin/compliance-form-dialog";
import { prisma } from "@/lib/prisma";

const TYPE_VARIANT: Record<string, "warning" | "danger" | "outline"> = {
  ADVERTENCIA: "warning",
  SUSPENSAO: "danger",
  PROCESSO: "danger",
};


export default async function CompliancePage({
  searchParams,
}: {
  searchParams: Promise<{ unidade?: string; periodo?: string }>;
}) {
  const params = await searchParams;
  const filters = await resolveScopedFilters(params);

  const [kpis, byReason, table, employees] = await Promise.all([
    getComplianceKpis(filters),
    getComplianceByReason(filters),
    getComplianceTable(filters),
    prisma.employee.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const executive = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Advertências" value={formatNumber(kpis.advertencias)} icon={FileText} accent="gold" />
        <KpiCard label="Suspensões" value={formatNumber(kpis.suspensoes)} icon={AlertOctagon} accent="danger" />
        <KpiCard label="Processos trabalhistas" value={formatNumber(kpis.processos)} icon={Gavel} accent="danger" />
        <KpiCard label="Passivo estimado" value={formatCurrency(kpis.estimatedLiability)} icon={Wallet} accent="danger" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Ocorrências por motivo</CardTitle>
        </CardHeader>
        <CardContent>
          {byReason.length > 0 ? <RankingBarChart data={byReason} /> : <p className="text-sm text-muted-foreground">Sem ocorrências no período.</p>}
        </CardContent>
      </Card>
    </div>
  );

  const managerial = (
    <Card>
      <CardHeader>
        <CardTitle>Distribuição de ocorrências por motivo</CardTitle>
      </CardHeader>
      <CardContent>
        {byReason.length > 0 ? <RankingBarChart data={byReason} color="#B23A48" /> : <p className="text-sm text-muted-foreground">Sem dados.</p>}
      </CardContent>
    </Card>
  );

  const operational = (
    <Card>
      <CardHeader className="flex-col items-start gap-3 space-y-0 md:flex-row md:items-center md:justify-between">
        <CardTitle>Ocorrências de compliance</CardTitle>
        <ComplianceFormDialog employees={employees} />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Colaborador</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Custo estimado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{e.employee.name}</TableCell>
                <TableCell>{e.employee.unit.name}</TableCell>
                <TableCell>{formatDate(e.date)}</TableCell>
                <TableCell>
                  <Badge variant={TYPE_VARIANT[e.type] ?? "outline"}>{COMPLIANCE_TYPE_LABEL[e.type] ?? e.type}</Badge>
                </TableCell>
                <TableCell>{e.reason?.label ?? "—"}</TableCell>
                <TableCell>{e.estimatedCost ? formatCurrency(e.estimatedCost) : "—"}</TableCell>
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
        <CardTitle>Indicadores de risco</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="Passivo estimado" value={formatCurrency(kpis.estimatedLiability)} icon={Wallet} accent="danger" />
        <KpiCard label="Processos ativos" value={formatNumber(kpis.processos)} icon={Gavel} accent="danger" />
        <KpiCard label="Total de ocorrências" value={formatNumber(kpis.total)} icon={FileText} accent="navy" />
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader title="Compliance Trabalhista" description="Advertências, suspensões, processos e passivo trabalhista estimado." moduleKey="compliance" />
      <ModuleViewTabs executive={executive} managerial={managerial} operational={operational} analytical={analytical} />
    </div>
  );
}
