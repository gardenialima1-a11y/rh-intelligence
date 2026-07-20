import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getEmployeeReportData } from "@/services/employee-report";
import { formatDate, formatNumber } from "@/lib/utils";
import { COMPLIANCE_TYPE_LABEL } from "@/lib/labels";
import { ABSENCE_TYPE_LABEL } from "@/lib/validation/absence";
import { PrintButton } from "@/components/print-button";

const ALLOWED_ROLES = ["ADMINISTRADOR", "RH", "DIRETORIA"];

export default async function EmployeeReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!ALLOWED_ROLES.includes(session.user.role)) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Você não tem permissão para ver este relatório.</div>;
  }

  const data = await getEmployeeReportData(id);
  if (!data) notFound();

  const { employee, absences, complianceEvents, summary } = data;
  const now = new Date();

  return (
    <div className="mx-auto max-w-3xl bg-white px-8 py-10 text-navy-dark print:px-0 print:py-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <p className="text-sm text-muted-foreground">Relatório gerado pela plataforma de People Analytics &amp; RH BI.</p>
        <PrintButton />
      </div>

      <header className="mb-8 flex items-center justify-between border-b-2 border-navy pb-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Relatório do Colaborador</h1>
          <p className="text-sm text-muted-foreground">Gerado em {formatDate(now)} por {session.user.name ?? session.user.email}</p>
        </div>
      </header>

      <section className="mb-8 grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border border-border p-4 text-sm">
        <div><span className="font-semibold">Nome:</span> {employee.name}</div>
        <div><span className="font-semibold">Matrícula:</span> {employee.registration}</div>
        <div><span className="font-semibold">Cargo:</span> {employee.position?.name ?? "—"}</div>
        <div><span className="font-semibold">Unidade:</span> {employee.unit.name}</div>
        <div><span className="font-semibold">Setor principal:</span> {employee.costCenter?.name ?? "—"}</div>
        <div><span className="font-semibold">Setor secundário:</span> {employee.secondaryCostCenter?.name ?? "—"}</div>
        <div><span className="font-semibold">Gestor:</span> {employee.manager?.name ?? "—"}</div>
        <div><span className="font-semibold">Admissão:</span> {formatDate(employee.admissionDate)}</div>
      </section>

      <section className="mb-8 grid grid-cols-4 gap-3 text-center">
        <div className="rounded-lg bg-gold/10 p-3">
          <p className="text-xl font-bold text-gold-text">{formatNumber(summary.totalAtestados)}</p>
          <p className="text-xs text-muted-foreground">Atestados</p>
        </div>
        <div className="rounded-lg bg-navy/10 p-3">
          <p className="text-xl font-bold text-navy">{formatNumber(summary.totalHoursLost)}h</p>
          <p className="text-xs text-muted-foreground">Horas perdidas</p>
        </div>
        <div className="rounded-lg bg-warning/10 p-3">
          <p className="text-xl font-bold text-warning-text">{formatNumber(summary.advertencias)}</p>
          <p className="text-xs text-muted-foreground">Advertências</p>
        </div>
        <div className="rounded-lg bg-danger/10 p-3">
          <p className="text-xl font-bold text-danger">{formatNumber(summary.suspensoes)}</p>
          <p className="text-xs text-muted-foreground">Suspensões</p>
        </div>
      </section>

      <section className="mb-8 break-inside-avoid">
        <h2 className="mb-2 border-b border-border pb-1 text-base font-bold text-navy">Histórico de atestados ({absences.length})</h2>
        {absences.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum atestado registrado.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-1.5 pr-2">Data</th>
                <th className="py-1.5 pr-2">Retorno</th>
                <th className="py-1.5 pr-2">Tipo</th>
                <th className="py-1.5 pr-2">CID</th>
                <th className="py-1.5 pr-2">Motivo</th>
                <th className="py-1.5 pr-2">Horas</th>
              </tr>
            </thead>
            <tbody>
              {absences.map((a) => (
                <tr key={a.id} className="border-b border-border/50">
                  <td className="py-1.5 pr-2">{formatDate(a.date)}</td>
                  <td className="py-1.5 pr-2">{a.returnDate ? formatDate(a.returnDate) : "—"}</td>
                  <td className="py-1.5 pr-2">{a.absenceType ? ABSENCE_TYPE_LABEL[a.absenceType as keyof typeof ABSENCE_TYPE_LABEL] ?? a.absenceType : "—"}</td>
                  <td className="py-1.5 pr-2">{a.cid ?? "—"}</td>
                  <td className="py-1.5 pr-2">{a.reason?.label ?? "—"}</td>
                  <td className="py-1.5 pr-2">{a.hoursLost}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mb-8 break-inside-avoid">
        <h2 className="mb-2 border-b border-border pb-1 text-base font-bold text-navy">
          Histórico de medidas disciplinares ({complianceEvents.length})
        </h2>
        {complianceEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma medida disciplinar registrada.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-1.5 pr-2">Data</th>
                <th className="py-1.5 pr-2">Tipo</th>
                <th className="py-1.5 pr-2">Motivo</th>
                <th className="py-1.5 pr-2">Custo estimado</th>
              </tr>
            </thead>
            <tbody>
              {complianceEvents.map((e) => (
                <tr key={e.id} className="border-b border-border/50">
                  <td className="py-1.5 pr-2">{formatDate(e.date)}</td>
                  <td className="py-1.5 pr-2">{COMPLIANCE_TYPE_LABEL[e.type] ?? e.type}</td>
                  <td className="py-1.5 pr-2">{e.reason?.label ?? "—"}</td>
                  <td className="py-1.5 pr-2">{e.estimatedCost ? `R$ ${e.estimatedCost.toFixed(2)}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer className="mt-10 border-t border-border pt-3 text-[10px] text-muted-foreground">
        Documento gerado automaticamente para fins de acompanhamento interno de RH. Não substitui laudo médico,
        perícia do INSS ou orientação jurídica.
      </footer>
    </div>
  );
}
