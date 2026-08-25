import { auth } from "@/lib/auth";
import { loadCompanyLogoDataUrl } from "@/lib/pdf/company-logo";
import { buildRecruitmentMonthlyDeck } from "@/lib/pptx/recruitment-monthly-deck";
import { getMonthlyRecruitmentReport } from "@/services/recruitment-monthly-report";

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

  const buffer = await buildRecruitmentMonthlyDeck(report, logoDataUrl);

  const fileMonth = mes && /^\d{4}-\d{2}$/.test(mes) ? mes : new Date().toISOString().slice(0, 7);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="recrutamento-mensal-${fileMonth}.pptx"`,
    },
  });
}
