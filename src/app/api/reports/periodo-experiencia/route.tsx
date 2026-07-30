import { renderToBuffer } from "@react-pdf/renderer";
import { auth } from "@/lib/auth";
import { getProbationOverview } from "@/actions/probation";
import { loadCompanyLogoDataUrl } from "@/lib/pdf/company-logo";
import { ProbationReportDocument } from "@/lib/pdf/probation-report";

const ALLOWED_ROLES = ["ADMINISTRADOR", "RH"];

export async function GET() {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    return new Response("Sem permissão.", { status: 403 });
  }

  const { emAndamento } = await getProbationOverview();
  const logoDataUrl = await loadCompanyLogoDataUrl();

  const rows = emAndamento.map((c) => ({
    name: c.name,
    registration: c.registration,
    position: c.position?.name ?? "—",
    costCenter: c.costCenter?.name ?? "—",
    manager: c.manager?.name ?? "—",
    admissionDate: c.admissionDate,
    checkpoint2: c.dates.checkpoint2,
    diasRestantes: c.diasRestantes,
    alerta: c.alerta,
    status60: c.status60,
  }));

  const buffer = await renderToBuffer(<ProbationReportDocument rows={rows} logoDataUrl={logoDataUrl} />);

  const today = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="periodo-experiencia-${today}.pdf"`,
    },
  });
}
