import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { loadCompanyLogoDataUrl } from "@/lib/pdf/company-logo";
import { RecruitmentMonthlyReportDocument } from "@/lib/pdf/recruitment-monthly-report";
import { getMonthlyRecruitmentReport } from "@/services/recruitment-monthly-report";

// Mesmo relatório que aparece na tela ("Relatório mensal para a diretoria"),
// aqui exportado como PDF de verdade para anexar em e-mail ou imprimir antes
// da reunião de indicadores.
const ALLOWED_ROLES = ["ADMINISTRADOR", "RH", "DIRETORIA"];

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    return new Response("Sem permissão.", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const mes = searchParams.get("mes") ?? undefined;

  const [report, logoDataUrl] = await Promise.all([
    getMonthlyRecruitmentReport(mes),
    loadCompanyLogoDataUrl(),
  ]);

  const buffer = await renderToBuffer(<RecruitmentMonthlyReportDocument report={report} logoDataUrl={logoDataUrl} />);

  const fileMonth = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : new Date().toISOString().slice(0, 7);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="recrutamento-mensal-${fileMonth}.pdf"`,
    },
  });
}
