import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getVacancyReportData } from "@/services/vacancy-report";
import { formatDate, formatNumber } from "@/lib/utils";
import { FUNNEL_STAGE_LABEL } from "@/lib/labels";
import { PrintButton } from "@/components/print-button";

const ALLOWED_ROLES = ["ADMINISTRADOR", "RH", "GESTOR", "DIRETORIA"];

const STAGE_ORDER = ["TRIAGEM", "ENTREVISTA_RH", "ENTREVISTA_GESTOR", "TESTE", "PROPOSTA", "CONTRATADO", "REPROVADO"];

const STATUS_LABEL: Record<string, string> = {
  ABERTA: "Aberta",
  EM_ANDAMENTO: "Em andamento",
  PREENCHIDA: "Preenchida",
  CANCELADA: "Cancelada",
  EM_PAUSA: "Em pausa",
};

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
      <div className="mb-6 flex items-center justify-between print:hidden">
        <p className="text-sm text-muted-foreground">Relatório gerado pela plataforma de People Analytics &amp; RH BI.</p>
        <PrintButton />
      </div>

      <header className="mb-8 flex items-center justify-between border-b-2 border-navy pb-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Relatório de Vaga — {vacancy.title}</h1>
          <p className="text-sm text-muted-foreground">Gerado em {formatDate(now)} por {session.user.name ?? session.user.email}</p>
        </div>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border border-border p-4 text-sm">
        <div><span className="font-semibold">Cargo:</span> {vacancy.position?.name ?? "—"}</div>
        <div><span className="font-semibold">Unidade:</span> {vacancy.unit?.name ?? "—"}</div>
        <div><span className="font-semibold">Status:</span> {STATUS_LABEL[vacancy.status] ?? vacancy.status}</div>
        <div><span className="font-semibold">Prioridade:</span> {vacancy.isCritical ? "Crítica" : "Normal"}</div>
        <div><span className="font-semibold">Data de abertura:</span> {formatDate(vacancy.openedAt)}</div>
        <div><span className="font-semibold">Data de fechamento:</span> {vacancy.closedAt ? formatDate(vacancy.closedAt) : "—"}</div>
        {vacancy.hiredCandidateName && (
          <div className="col-span-2"><span className="font-semibold">Contratado(a):</span> {vacancy.hiredCandidateName}</div>
        )}
        {vacancy.negotiationNotes && (
          <div className="col-span-2"><span className="font-semibold">Observação da negociação:</span> {vacancy.negotiationNotes}</div>
        )}
      </section>

      <section className="mb-8 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg bg-navy/10 p-3">
          <p className="text-xl font-bold text-navy">{sla.daysElapsed}</p>
          <p className="text-xs text-muted-foreground">{sla.isOpen ? "Dias em aberto" : "Dias até fechar"}</p>
        </div>
        <div className={"rounded-lg p-3 " + (sla.isBreached ? "bg-danger/10" : "bg-success/10")}>
          <p className={"text-xl font-bold " + (sla.isBreached ? "text-danger" : "text-success")}>{vacancy.targetDays}d</p>
          <p className="text-xs text-muted-foreground">Meta (SLA) {sla.isBreached ? "— estourada" : "— dentro do prazo"}</p>
        </div>
        <div className="rounded-lg bg-gold/10 p-3">
          <p className="text-xl font-bold text-gold-text">{candidates.length}</p>
          <p className="text-xs text-muted-foreground">Candidatos no total</p>
        </div>
      </section>

      <section className="mb-8 break-inside-avoid">
        <h2 className="mb-2 border-b border-border pb-1 text-base font-bold text-navy">Previsão de conclusão</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">Meta contratual (data de abertura + SLA da vaga)</p>
            <p className="font-semibold">{formatDate(targetDate)}</p>
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs text-muted-foreground">
              {historicalAvgDays
                ? "Previsão baseada no histórico (média " + historicalAvgDays + " dia(s) para vagas similares)"
                : "Previsão baseada no histórico"}
            </p>
            <p className="font-semibold">{forecastDate ? formatDate(forecastDate) : "Sem histórico suficiente ainda"}</p>
          </div>
        </div>
      </section>

      <section className="mb-8 break-inside-avoid">
        <h2 className="mb-2 border-b border-border pb-1 text-base font-bold text-navy">Candidatos por etapa</h2>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="py-1.5 pr-2">Etapa</th>
              <th className="py-1.5 pr-2">Candidatos</th>
            </tr>
          </thead>
          <tbody>
            {STAGE_ORDER.map((stage) => (
              <tr key={stage} className="border-b border-border/50">
                <td className="py-1.5 pr-2">{FUNNEL_STAGE_LABEL[stage] ?? stage}</td>
                <td className="py-1.5 pr-2">{formatNumber(funnelCounts[stage] ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mb-8 break-inside-avoid">
        <h2 className="mb-2 border-b border-border pb-1 text-base font-bold text-navy">Lista de candidatos ({candidates.length})</h2>
        {candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum candidato cadastrado para esta vaga ainda.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-1.5 pr-2">Nome</th>
                <th className="py-1.5 pr-2">Origem</th>
                <th className="py-1.5 pr-2">Etapa atual</th>
                <th className="py-1.5 pr-2">Data de entrada</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.id} className="border-b border-border/50">
                  <td className="py-1.5 pr-2">{c.name}</td>
                  <td className="py-1.5 pr-2">{c.source}</td>
                  <td className="py-1.5 pr-2">{FUNNEL_STAGE_LABEL[c.stage] ?? c.stage}</td>
                  <td className="py-1.5 pr-2">{formatDate(c.openedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer className="mt-10 border-t border-border pt-3 text-[10px] text-muted-foreground">
        A &quot;previsão baseada no histórico&quot; é uma estimativa estatística simples (média de dias até o fechamento de
        vagas similares já preenchidas) — não é uma garantia de prazo.
      </footer>
    </div>
  );
}
