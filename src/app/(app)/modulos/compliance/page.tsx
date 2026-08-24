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
import { getComplianceKpis, getComplianceByReason, getComplianceTable, getDisciplinaryRanking } from "@/services/compliance";
import { ComplianceFormDialog } from "@/components/admin/compliance-form-dialog";
import { DisciplinaryRankingTable } from "@/components/dashboard/disciplinary-ranking-table";
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

  const [kpis, byReason, table, employees, ranking, activeUnit] = await Promise.all([
    getComplianceKpis(filters),
    getComplianceByReason(filters),
    getComplianceTable(filters),
    prisma.employee.findMany({
      where: { isActive: true, ...(filters.unitId ? { unitId: filters.unitId } : {}) },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getDisciplinaryRanking(filters),
    filters.unitId ? prisma.unit.findUnique({ where: { id: filters.unitId }, select: { name: true } }) : null,
  ]);

  const executive = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Advertências" value={formatNumber(kpis.advertencias)} icon={FileText} accent="gold" tooltip={"Total de ocorrências do tipo Advertência registradas no período selecionado."} />
        <KpiCard label="Suspensões" value={formatNumber(kpis.suspensoes)} icon={AlertOctagon} accent="danger" tooltip={"Total de ocorrências do tipo Suspensão registradas no período selecionado."} />
        <KpiCard label="Processos trabalhistas" value={formatNumber(kpis.processos)} icon={Gavel} accent="danger" tooltip={"Total de ocorrências do tipo Processo registradas no período selecionado."} />
        <KpiCard label="Passivo estimado" value={formatCurrency(kpis.estimatedLiability)} icon={Wallet} accent="danger" tooltip={"Soma do custo estimado (campo preenchido no cadastro da ocorrência) de todas as ocorrências de compliance do período."} />
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
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Ranking disciplinar — advertências e suspensões por colaborador</CardTitle>
        </CardHeader>
        <CardContent>
          <DisciplinaryRankingTable rows={ranking} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Distribuição de ocorrências por motivo</CardTitle>
        </CardHeader>
        <CardContent>
          {byReason.length > 0 ? <RankingBarChart data={byReason} color="#B23A48" /> : <p className="text-sm text-muted-foreground">Sem dados.</p>}
        </CardContent>
      </Card>
    </div>
  );

  const operational = (
    <Card>
      <CardHeader className="flex-col items-start gap-3 space-y-0 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle>Ocorrências de compliance</CardTitle>
          {activeUnit && (
            <p className="text-xs text-muted-foreground">
              Filtro de unidade ativo: <strong>{activeUnit.name}</strong>. Só é possível selecionar colaboradores dessa
              unidade, e a tabela abaixo só mostra ocorrências dela. Para outras unidades, mude o filtro de Unidade no
              topo da página.
            </p>
          )}
        </div>
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
        <KpiCard label="Passivo estimado" value={formatCurrency(kpis.estimatedLiability)} icon={Wallet} accent="danger" tooltip={"Soma do custo estimado (campo preenchido no cadastro da ocorrência) de todas as ocorrências de compliance do período."} />
        <KpiCard label="Processos ativos" value={formatNumber(kpis.processos)} icon={Gavel} accent="danger" tooltip={"Total de ocorrências do tipo Processo registradas no período selecionado."} />
        <KpiCard label="Total de ocorrências" value={formatNumber(kpis.total)} icon={FileText} accent="navy" tooltip={"Total de ocorrências de compliance (advertências, suspensões e processos somados) registradas no período."} />
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
