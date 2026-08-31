import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { resolveScopedFilters } from "@/lib/scope";
import { loadCompanyLogoDataUrl } from "@/lib/pdf/company-logo";
import { CatracaReportDocument } from "@/lib/pdf/catraca-report";
import { getCatracaReportData } from "@/services/catraca-report";

// Exportação em PDF do relatório gerencial da Catraca (mesmos pontos de
// atenção da aba Executiva, mais horário de pico, distribuição por setor,
// evolução mensal e ranking de colaboradores críticos) — pra anexar em
// e-mail ou levar impresso pra reunião com a diretoria.
const ALLOWED_ROLES = ["ADMINISTRADOR", "RH", "DIRETORIA", "GESTOR"];

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    return new Response("Sem permissão.", { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const unidade = searchParams.get("unidade") ?? undefined;
  const periodoParam = searchParams.get("periodo") ?? undefined;
  const inicio = searchParams.get("inicio") ?? undefined;
  const fim = searchParams.get("fim") ?? undefined;

  // Período customizado (ex.: "01/08/2025 a 31/08/2026" escolhido no diálogo
  // de exportação) tem prioridade sobre o filtro fixo "periodo" da tela.
  let periodo = periodoParam;
  if (inicio || fim) {
    if (!inicio || !fim || !ISO_DATE_PATTERN.test(inicio) || !ISO_DATE_PATTERN.test(fim)) {
      return new Response("Período inválido. Informe data inicial e final no formato AAAA-MM-DD.", { status: 400 });
    }
    if (inicio > fim) {
      return new Response("A data inicial não pode ser depois da data final.", { status: 400 });
    }
    periodo = `custom:${inicio}:${fim}`;
  }

  // Reaplica a mesma regra de escopo por unidade usada na tela: gestores e
  // demais perfis não corporativos só podem exportar a própria unidade,
  // mesmo que tentem trocar o parâmetro "unidade" diretamente na URL.
  const filters = await resolveScopedFilters({ unidade, periodo });

  const [data, logoDataUrl] = await Promise.all([
    getCatracaReportData(filters),
    loadCompanyLogoDataUrl(),
  ]);

  const buffer = await renderToBuffer(<CatracaReportDocument data={data} logoDataUrl={logoDataUrl} />);

  const today = new Date().toISOString().slice(0, 10);
  const rangeSuffix = inicio && fim ? `${inicio}_a_${fim}` : today;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="catraca-relatorio-gerencial-${rangeSuffix}.pdf"`,
    },
  });
}
