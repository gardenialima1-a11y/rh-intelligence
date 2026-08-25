import { FileDown, Presentation, Phone, Users, UserCog, Briefcase, CheckCircle2, Timer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { formatNumber, formatCurrency, formatDate } from "@/lib/utils";
import type { MonthlyRecruitmentReport } from "@/services/recruitment-monthly-report";

function formatDelta(fraction: number): { label: string; positive: boolean } {
  const pct = Math.round(fraction * 1000) / 10;
  const positive = pct >= 0;
  return { label: `${positive ? "+" : ""}${pct.toString().replace(".", ",")}%`, positive };
}

function DeltaBadge({ fraction }: { fraction: number }) {
  const { label, positive } = formatDelta(fraction);
  if (fraction === 0) return <span className="text-[11px] text-muted-foreground">estável vs. mês anterior</span>;
  return (
    <span className={`text-[11px] font-medium ${positive ? "text-success" : "text-danger"}`}>
      {label} vs. mês anterior
    </span>
  );
}

function IndicatorTile({
  icon: Icon,
  label,
  value,
  delta,
  sublabel,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
  delta?: number;
  sublabel?: string;
}) {
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-2 flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <p className="text-xs font-medium">{label}</p>
      </div>
      <p className="text-2xl font-bold text-navy dark:text-cream">{value}</p>
      {sublabel && <p className="mt-0.5 text-[11px] text-muted-foreground">{sublabel}</p>}
      {delta !== undefined && <div className="mt-1">
        <DeltaBadge fraction={delta} />
      </div>}
    </div>
  );
}

export function MonthlyReportPanel({ report, monthParam }: { report: MonthlyRecruitmentReport; monthParam: string }) {
  const { current, deltas } = report;

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <div className="flex flex-col gap-1">
          <CardTitle>Relatório mensal para a diretoria</CardTitle>
          <p className="text-xs text-muted-foreground">
            Indicadores de atividade e resultado de <strong>{current.monthLabel}</strong>, comparados ao mês anterior.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form method="GET" className="flex items-center gap-2">
            <input
              type="month"
              name="mes"
              defaultValue={monthParam}
              className="h-8 rounded-md border border-border bg-transparent px-2 text-xs"
            />
            <Button type="submit" variant="outline" size="sm">Ver mês</Button>
          </form>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/reports/recrutamento-mensal?mes=${monthParam}`} title="Baixar PDF do relatório mensal">
              <FileDown className="h-3.5 w-3.5" /> PDF
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={`/api/reports/recrutamento-mensal-pptx?mes=${monthParam}`} title="Baixar apresentação de slides">
              <Presentation className="h-3.5 w-3.5" /> Slides
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <IndicatorTile icon={Briefcase} label="Candidatos cadastrados" value={formatNumber(current.candidatesRegistered)} delta={deltas.candidatesRegistered} />
          <IndicatorTile
            icon={Phone}
            label="Entrevistas realizadas"
            value={formatNumber(current.totalInterviews)}
            delta={deltas.totalInterviews}
            sublabel={`${current.interviewsRH} com RH · ${current.interviewsGestor} com gestor`}
          />
          <IndicatorTile icon={Users} label="Pessoas com quem conversei" value={formatNumber(current.peopleContacted)} delta={deltas.peopleContacted} sublabel="Ligações e entrevistas (exclui e-mail/mensagem)" />
          <IndicatorTile icon={CheckCircle2} label="Vagas fechadas no mês" value={formatNumber(current.vacanciesClosed)} delta={deltas.vacanciesClosed} sublabel={current.vacanciesCancelled > 0 ? `${current.vacanciesCancelled} cancelada(s)` : undefined} />
          <IndicatorTile icon={Timer} label="Tempo médio até fechar" value={current.avgDaysToClose !== null ? `${current.avgDaysToClose}d` : "—"} sublabel="Das vagas fechadas neste mês" />
          <IndicatorTile icon={UserCog} label="Contratações" value={formatNumber(current.hires)} delta={deltas.hires} sublabel={current.avgCostToHire !== null ? `Custo médio: ${formatCurrency(current.avgCostToHire)}` : undefined} />
        </div>

        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vagas fechadas em {current.monthLabel} ({current.closedVacancies.length})</h3>
          {current.closedVacancies.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma vaga fechada neste mês.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vaga</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Contratado(a)</TableHead>
                  <TableHead>Fechada em</TableHead>
                  <TableHead>Dias até fechar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {current.closedVacancies.map((v, i) => (
                  <TableRow key={i}>
                    <TableCell>{v.title}</TableCell>
                    <TableCell>{v.unitName ?? "—"}</TableCell>
                    <TableCell>{v.hiredCandidateName ?? "—"}</TableCell>
                    <TableCell>{v.closedAt ? formatDate(v.closedAt) : "—"}</TableCell>
                    <TableCell>{v.daysToClose ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
