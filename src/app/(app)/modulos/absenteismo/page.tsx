import { resolveScopedFilters } from "@/lib/scope";
import { AlertTriangle, Clock3, Wallet, ListChecks, Gauge } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { ModuleViewTabs } from "@/components/dashboard/module-view-tabs";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { RankingBarChart } from "@/components/dashboard/ranking-bar-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatPercent, formatCurrency, formatDate } from "@/lib/utils";
import { lastNMonthsKeys, monthLabelsPtBR } from "@/services/period";
import { TableCardHeader } from "@/components/dashboard/table-card-header";
import { AttendanceImportDialog } from "@/components/admin/attendance-import-dialog";
import {
  getAbsenteismoKpis,
  getAbsenceByReason,
  getAbsenceByCostCenter,
  getAbsenceTable,
  getBradfordFactorRanking,
  getFaltasComCruzamento,
  getFaltasPorSetorPrincipal,
  getFaltasPorSetorSecundario,
} from "@/services/absenteismo";

const BRADFORD_VARIANT: Record<string, "danger" | "warning" | "outline"> = {
  Crítico: "danger",
  Atenção: "warning",
  Normal: "outline",
};

export default async function AbsenteismoPage({
  searchParams,
}: {
  searchParams: Promise<{ unidade?: string; periodo?: string }>;
}) {
  const params = await searchParams;
  const filters = await resolveScopedFilters(params);

  const [kpis, byReason, byCostCenter, table, bradford, faltas, faltasPorPrincipal, faltasPorSecundario] = await Promise.all([
    getAbsenteismoKpis(filters),
    getAbsenceByReason(filters),
    getAbsenceByCostCenter(filters),
    getAbsenceTable(filters),
    getBradfordFactorRanking(filters),
    getFaltasComCruzamento(),
    getFaltasPorSetorPrincipal(),
    getFaltasPorSetorSecundario(),
  ]);

  const monthLabels = monthLabelsPtBR(lastNMonthsKeys(12));
  const criticalBradford = bradford.filter((b) => b.riskLevel === "Crítico");

  const executive = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Taxa de absenteísmo" value={formatPercent(kpis.rate)} icon={AlertTriangle} deltaLabel={formatPercent(Math.abs(kpis.delta))} deltaDirection={kpis.delta >= 0 ? "up" : "down"} deltaSentiment={kpis.delta >= 0 ? "negative" : "positive"} sparklineData={kpis.series} accent="gold" />
        <KpiCard label="Horas perdidas" value={`${formatNumber(kpis.hoursLost)} h`} icon={Clock3} accent="danger" />
        <KpiCard label="Ocorrências" value={formatNumber(kpis.occurrences)} icon={ListChecks} accent="navy" />
        <KpiCard label="Custo estimado" value={formatCurrency(kpis.estimatedCost)} icon={Wallet} accent="danger" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Absenteísmo — 12 meses</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart data={kpis.series.map((v) => v * 100)} labels={monthLabels} color="#C9922E" format="percent1" />
        </CardContent>
      </Card>
    </div>
  );

  const managerial = (
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
  );

  const operational = (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div className="flex flex-col gap-1">
            <CardTitle>Faltas detectadas pelo ponto (automático)</CardTitle>
            <p className="text-xs text-muted-foreground">{faltas.length} falta(s) registrada(s), já cruzadas com atestados.</p>
          </div>
          <AttendanceImportDialog />
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div>
              <h4 className="mb-2 text-sm font-semibold text-navy dark:text-cream">Faltas por setor principal</h4>
              {faltasPorPrincipal.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma falta importada ainda.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Setor</TableHead>
                      <TableHead>Faltas</TableHead>
                      <TableHead>Com atestado</TableHead>
                      <TableHead>Sem atestado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {faltasPorPrincipal.map((r) => (
                      <TableRow key={r.setor}>
                        <TableCell>{r.setor}</TableCell>
                        <TableCell>{r.faltas}</TableCell>
                        <TableCell><Badge variant="success">{r.comAtestado}</Badge></TableCell>
                        <TableCell><Badge variant="danger">{r.semAtestado}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
            <div>
              <h4 className="mb-2 text-sm font-semibold text-navy dark:text-cream">Faltas por setor secundário</h4>
              {faltasPorSecundario.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma falta com setor secundário identificado.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Setor</TableHead>
                      <TableHead>Faltas</TableHead>
                      <TableHead>Com atestado</TableHead>
                      <TableHead>Sem atestado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {faltasPorSecundario.map((r) => (
                      <TableRow key={r.setor}>
                        <TableCell>{r.setor}</TableCell>
                        <TableCell>{r.faltas}</TableCell>
                        <TableCell><Badge variant="success">{r.comAtestado}</Badge></TableCell>
                        <TableCell><Badge variant="danger">{r.semAtestado}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>

          <div>
            <h4 className="mb-2 text-sm font-semibold text-navy dark:text-cream">Detalhamento das faltas</h4>
            {faltas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma falta importada ainda.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Colaborador</TableHead>
                    <TableHead>Setor principal</TableHead>
                    <TableHead>Setor secundário</TableHead>
                    <TableHead>Atestado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {faltas.slice(0, 50).map((f, i) => (
                    <TableRow key={i}>
                      <TableCell>{formatDate(f.date)}</TableCell>
                      <TableCell>{f.employeeName}</TableCell>
                      <TableCell>{f.setorPrincipal ?? "—"}</TableCell>
                      <TableCell>{f.setorSecundario ?? "—"}</TableCell>
                      <TableCell>
                        {f.temAtestado ? <Badge variant="success">Sim</Badge> : <Badge variant="danger">Não</Badge>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
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
    </div>
  );

  const analytical = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard label="Taxa de absenteísmo" value={formatPercent(kpis.rate)} icon={AlertTriangle} accent="gold" />
        <KpiCard label="Custo estimado" value={formatCurrency(kpis.estimatedCost)} icon={Wallet} accent="danger" />
        <KpiCard label="Colaboradores em nível crítico (Bradford)" value={formatNumber(criticalBradford.length)} icon={Gauge} accent="danger" />
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
