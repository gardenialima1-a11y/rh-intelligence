import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { getVacancyReportData } from "@/services/vacancy-report";
import { loadCompanyLogoDataUrl } from "@/lib/pdf/company-logo";
import { VacancyDetailReportDocument, type VacancyDetailRow } from "@/lib/pdf/vacancy-detail-report";

const ALLOWED_ROLES = ["ADMINISTRADOR", "RH", "DIRETORIA", "GESTOR"];

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    return new Response("Sem permissão.", { status: 403 });
  }

  const { id } = await params;
  const data = await getVacancyReportData(id);
  if (!data) return new Response("Vaga não encontrada.", { status: 404 });

  const logoDataUrl = await loadCompanyLogoDataUrl();
  const { vacancy, candidates, funnelCounts, sla } = data;

  const rows: VacancyDetailRow[] = candidates.map((c) => {
    const openEntry = c.stageHistory.find((h) => h.exitedAt === null);
    return {
      name: c.name,
      source: c.source,
      stage: c.stage,
      enteredStageAt: openEntry?.enteredAt ?? c.openedAt,
      openedAt: c.openedAt,
      rejectionReason: c.rejectionReason,
    };
  });

  const buffer = await renderToBuffer(
    <VacancyDetailReportDocument
      vacancy={{
        title: vacancy.title,
        positionName: vacancy.position?.name ?? null,
        unitName: vacancy.unit?.name ?? null,
        status: vacancy.status,
        isCritical: vacancy.isCritical,
        targetDays: vacancy.targetDays,
        openedAt: vacancy.openedAt,
        closedAt: vacancy.closedAt,
        hiredCandidateName: vacancy.hiredCandidateName,
        notes: vacancy.notes,
      }}
      rows={rows}
      funnelCounts={funnelCounts}
      sla={sla}
      logoDataUrl={logoDataUrl}
    />
  );

  const today = new Date().toISOString().slice(0, 10);
  const safeTitle = vacancy.title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase();

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="vaga-${safeTitle}-${today}.pdf"`,
    },
  });
}
