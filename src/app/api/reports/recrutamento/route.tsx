import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { loadCompanyLogoDataUrl } from "@/lib/pdf/company-logo";
import {
  RecruitmentOverviewReportDocument,
  type OpenVacancyRow,
  type ClosedVacancyRowPdf,
} from "@/lib/pdf/recruitment-overview-report";
import { getRecrutamentoKpis } from "@/services/recrutamento";
import { getVacancyPipelines } from "@/services/recrutamento-timeline";
import { getClosedVacanciesHistory } from "@/services/vacancy-report";

// Relatório corporativo com o status de TODAS as vagas — restrito aos perfis
// com visão de toda a empresa, mesma regra usada no restante do sistema para
// dados que não são só da unidade do usuário (ver CORPORATE_ROLES em lib/scope.ts).
const ALLOWED_ROLES = ["ADMINISTRADOR", "RH", "DIRETORIA"];

const STAGE_ORDER = ["TRIAGEM", "ENTREVISTA_RH", "ENTREVISTA_GESTOR", "TESTE", "PROPOSTA", "CONTRATADO"];

export async function GET() {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    return new Response("Sem permissão.", { status: 403 });
  }

  const [kpis, pipelines, closedVacancies, logoDataUrl] = await Promise.all([
    getRecrutamentoKpis({ period: "all" }),
    getVacancyPipelines(),
    getClosedVacanciesHistory(),
    loadCompanyLogoDataUrl(),
  ]);

  const openVacancies: OpenVacancyRow[] = pipelines.map((v) => {
    const furthestIndex = v.candidates.reduce((max, c) => Math.max(max, STAGE_ORDER.indexOf(c.stage)), -1);
    return {
      title: v.title,
      unitName: v.unit,
      status: v.status,
      isCritical: v.isCritical,
      daysOpen: v.daysOpen,
      targetDays: v.targetDays,
      isBreached: v.daysOpen > v.targetDays,
      activeCandidates: v.candidates.length,
      furthestStage: furthestIndex >= 0 ? STAGE_ORDER[furthestIndex] : null,
    };
  });

  const closedRows: ClosedVacancyRowPdf[] = closedVacancies.map((v) => ({
    title: v.title,
    unitName: v.unitName,
    status: v.status,
    hiredCandidateName: v.hiredCandidateName,
    closedAt: v.closedAt,
    daysToClose: v.daysToClose,
  }));

  const buffer = await renderToBuffer(
    <RecruitmentOverviewReportDocument
      kpis={{
        openVacancies: kpis.openVacancies,
        criticalVacancies: kpis.criticalVacancies,
        avgTimeToHire: kpis.avgTimeToHire,
        avgCostToHire: kpis.avgCostToHire,
        hiredCount: kpis.hiredCount,
      }}
      openVacancies={openVacancies}
      closedVacancies={closedRows}
      logoDataUrl={logoDataUrl}
    />
  );

  const today = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="recrutamento-status-${today}.pdf"`,
    },
  });
}
