import { notFound, redirect } from "next/navigation";
import { Download } from "lucide-react";
import { auth } from "@/lib/auth";
import { getVacancyReportData } from "@/services/vacancy-report";
import { formatDate, formatNumber } from "@/lib/utils";
import { FUNNEL_STAGE_LABEL } from "@/lib/labels";
import { PrintButton } from "@/components/print-button";
import { CompanyLogo } from "@/components/layout/company-logo";

const ALLOWED_ROLES = ["ADMINISTRADOR", "RH", "DIRETORIA", "GESTOR"];

const STATUS_LABEL: Record<string, string> = {
  ABERTA: "Aberta",
  EM_ANDAMENTO: "Em andamento",
  PREENCHIDA: "Preenchida",
  CANCELADA: "Cancelada",
  EM_PAUSA: "Em pausa",
};

const STAGE_ORDER = ["TRIAGEM", "ENTREVISTA_RH", "ENTREVISTA_GESTOR", "TESTE", "PROPOSTA", "CONTRATADO"] as const;

export default async function VacancyReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!ALLOWED_ROLES.includes(session.user.role)) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Você não tem permissão para ver este relatório.</div>;
  }

  const data = await getVacancyReportData(id);
  if (!data) notFound();

  const { vacancy, candidates, funnelCounts, sla, targetDate, historicalAvgDays, forecastDate } = data;
  const now = new Date();

  return (
    <div className="mx-auto max-w-3xl bg-white px-8 py-10 text-navy-dark print:px-0 print:py-0">
      <div className="mb-6 flex items-center justify-between gap-2 print:hidden">
        <p className="text-sm text-muted-foreground">Relatório gerado pela plataforma de People Analytics &amp; RH BI.</p>
        <div className="flex items-center gap-2">
          <a
            href={`/api/reports/vaga/${vacancy.id}`}
            className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-navy transition-colors hover:border-gold hover:text-gold-text dark:text-cream"
          >
            <Download className="h-4 w-4" /> Baixar PDF
          </a>
          <PrintButton />
        </div>
      </div>

      <header className="mb-8 flex items-center justify-between border-b-2 border-navy pb-4">
        <div className="flex items-center gap-3">
          <CompanyLogo />
          <div>
            <h1 className="text-2xl font-bold text-navy">Relatório da Vaga</h1>
            <p className="text-sm text-muted-foreground">Gerado em {formatDate(now)} por {session.user.name ?? session.user.email}</p>
          </div>
        </div>
        <span className="rounded-full border border-navy/20 bg-navy/5 px-3 py-1 text-xs font-semibold text-navy">
          {STATUS_LABEL[vacancy.status] ?? vacancy.status}
        </span>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border border-border p-4 text-sm">
        <div><span className="font-semibold">Vaga:</span> {vacancy.title}</div>
        <div><span className="font-semibold">Cargo:</span> {vacancy.position?.name ?? "—"}</div>
        <div><span className="font-semibold">Unidade:</span> {vacancy.unit?.name ?? "—"}</div>
        <div><span className="font-semibold">Crítica:</span> {vacancy.isCritical ? "Sim" : "Não"}</div>
        <div><span className="font-semibold">Aberta em:</span> {formatDate(vacancy.openedAt)}</div>
        <div><span className="font-semibold">{vacancy.closedAt ? "Fechada em:" : "Meta de SLA:"}</span> {vacancy.closedAt ? formatDate(vacancy.closedAt) : `${vacancy.targetDays} dia(s)`}</div>
        {vacancy.hiredCandidateName && (
          <div className="col-span-2"><span className="font-semibold">Contratado(a):</span> {vacancy.hiredCandidateName}</div>
        )}
        {vacancy.notes && (
          <div className="col-span-2"><span className="font-semibold">Observações:</span> {vacancy.notes}</div>
        )}
      </section>

      <section className="mb-8 grid grid-cols-4 gap-3 text-center">
        <div className={`rounded-lg p-3 ${sla.isBreached ? "bg-danger/10" : "bg-success/10"}`}>
          <p className={`text-xl font-bold ${sla.isBreached ? "text-danger" : "text-success"}`}>{formatNumber(sla.daysElapsed)}</p>
          <p className="text-xs text-muted-foreground">Dias {sla.isOpen ? "em aberto" : "até fechar"}</p>
        </div>
        <div className="rounded-lg bg-navy/10 p-3">
          <p className="text-xl font-bold text-navy">{vacancy.targetDays}</p>
          <p className="text-xs text-muted-foreground">Meta de SLA (dias)</p>
        </div>
        <div className="rounded-lg bg-gold/10 p-3">
          <p className="text-xl font-bold text-gold-text">{formatDate(targetDate)}</p>
          <p className="text-xs text-muted-foreground">Prazo-meta de fechamento</p>
        </div>
        <div className="rounded-lg bg-navy/10 p-3">
          <p className="text-xl font-bold text-navy">{forecastDate ? formatDate(forecastDate) : "—"}</p>
          <p className="text-xs text-muted-foreground">
            Previsão realista{historicalAvgDays ? ` (média histórica de ${historicalAvgDays}d)` : ""}
          </p>
        </div>
      </section>

      <section className="mb-8 break-inside-avoid">
        <h2 className="mb-3 border-b border-border pb-1 text-base font-bold text-navy">Linha do tempo do processo seletivo</h2>
        <div className="flex items-start justify-between gap-1">
          {STAGE_ORDER.map((stage) => (
            <div key={stage} className="flex flex-1 flex-col items-center gap-1 text-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-navy/30 bg-navy/5 text-xs font-bold text-navy">
                {funnelCounts[stage] ?? 0}
              </div>
              <p className="text-[10px] leading-tight text-muted-foreground">{FUNNEL_STAGE_LABEL[stage] ?? stage}</p>
            </div>
          ))}
          {funnelCounts.REPROVADO > 0 && (
            <div className="flex flex-1 flex-col items-center gap-1 text-center">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-danger/30 bg-danger/10 text-xs font-bold text-danger">
                {funnelCounts.REPROVADO}
              </div>
              <p className="text-[10px] leading-tight text-muted-foreground">Reprovado</p>
            </div>
          )}
        </div>
      </section>

      <section className="mb-8 break-inside-avoid">
        <h2 className="mb-2 border-b border-border pb-1 text-base font-bold text-navy">Candidatos ({candidates.length})</h2>
        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum candidato cadastrado para esta vaga ainda.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-1.5 pr-2">Candidato</th>
                <th className="py-1.5 pr-2">Origem</th>
                <th className="py-1.5 pr-2">Etapa atual</th>
                <th className="py-1.5 pr-2">Desde</th>
                <th className="py-1.5 pr-2">Aberto em</th>
                <th className="py-1.5 pr-2">Observação</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => {
                const openEntry = [...c.stageHistory].reverse().find((h) => h.exitedAt === null);
                return (
                  <tr key={c.id} className="border-b border-border/50">
                    <td className="py-1.5 pr-2 font-medium">{c.name}</td>
                    <td className="py-1.5 pr-2">{c.source}</td>
                    <td className="py-1.5 pr-2">{FUNNEL_STAGE_LABEL[c.stage] ?? c.stage}</td>
                    <td className="py-1.5 pr-2">{openEntry ? formatDate(openEntry.enteredAt) : "—"}</td>
                    <td className="py-1.5 pr-2">{formatDate(c.openedAt)}</td>
                    <td className="py-1.5 pr-2">{c.stage === "REPROVADO" ? (c.rejectionReason ?? "—") : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <footer className="mt-10 border-t border-border pt-3 text-[10px] text-muted-foreground">
        Documento gerado automaticamente pela plataforma de People Analytics &amp; RH BI para fins de acompanhamento
        interno do processo seletivo. Os prazos de SLA e a previsão de fechamento são estimativas, não compromissos
        contratuais.
      </footer>
    </div>
  );
}
