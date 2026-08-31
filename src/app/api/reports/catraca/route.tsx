import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { loadCompanyLogoDataUrl } from "@/lib/pdf/company-logo";
import { CatracaReportDocument } from "@/lib/pdf/catraca-report";
import { getCatracaReportData } from "@/services/catraca-report";

// Exportação em PDF do relatório gerencial da Catraca (mesmos pontos de
// atenção da aba Executiva, mais horário de pico, distribuição por setor,
// evolução mensal e ranking de colaboradores críticos) — pra anexar em
// e-mail ou levar impresso pra reunião com a diretoria.
const ALLOWED_ROLES = ["ADMINISTRADOR", "RH", "DIRETORIA", "GESTOR"];

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    return new Response("Sem permissão.", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const unidade = searchParams.get("unidade") ?? undefined;
  const periodo = searchParams.get("periodo") ?? undefined;

  const [data, logoDataUrl] = await Promise.all([
    getCatracaReportData({ unitId: unidade, period: periodo }),
    loadCompanyLogoDataUrl(),
  ]);

  const buffer = await renderToBuffer(<CatracaReportDocument data={data} logoDataUrl={logoDataUrl} />);

  const today = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="catraca-relatorio-gerencial-${today}.pdf"`,
    },
  });
}
