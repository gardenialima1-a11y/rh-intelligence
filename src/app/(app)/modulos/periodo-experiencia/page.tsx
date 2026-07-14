import { UserCheck, AlertTriangle } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { TableCardHeader } from "@/components/dashboard/table-card-header";
import { ProbationTable } from "@/components/admin/probation-table";
import { getProbationCandidates } from "@/actions/probation";
import { computeProbationDates, resolveDisplayStatus, type StoredProbationStatus } from "@/lib/analytics/probation";
import { formatNumber } from "@/lib/utils";

export default async function PeriodoExperienciaPage() {
  const candidates = await getProbationCandidates();

  const withComputed = candidates.map((c) => {
    const dates = computeProbationDates(c.admissionDate);
    const status30 = resolveDisplayStatus((c.probationTracking?.status30 ?? "EM_AVALIACAO") as StoredProbationStatus, dates.checkpoint1);
    const status60 = resolveDisplayStatus((c.probationTracking?.status60 ?? "EM_AVALIACAO") as StoredProbationStatus, dates.checkpoint2);
    return { ...c, dates, status30, status60 };
  });

  const expiredNotEvaluated = withComputed.filter((c) => c.status30 === "PRAZO_EXPIRADO_NAO_AVALIADO" || c.status60 === "PRAZO_EXPIRADO_NAO_AVALIADO").length;
  const inProgress = withComputed.filter((c) => c.status60 === "EM_AVALIACAO").length;

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader
        title="Período de Experiência"
        description="Colaboradores nos primeiros 90 dias (30 + 60), com checkpoints calculados a partir da data real de admissão."
        moduleKey="periodo-experiencia"
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <KpiCard label="Em período de experiência" value={formatNumber(candidates.length)} icon={UserCheck} accent="navy" />
        <KpiCard label="Ainda em avaliação" value={formatNumber(inProgress)} icon={UserCheck} accent="gold" />
        <KpiCard label="Prazo expirado sem avaliação" value={formatNumber(expiredNotEvaluated)} icon={AlertTriangle} accent="danger" />
      </div>

      <Card>
        <TableCardHeader
          title="Acompanhamento"
          filename="periodo-experiencia"
          data={withComputed.map((c) => ({
            nome: c.name,
            matricula: c.registration,
            cargo: c.position?.name ?? "",
            setor: c.costCenter?.name ?? "",
            gestor: c.manager?.name ?? "",
            admissao: c.admissionDate,
            checkpoint_30d: c.dates.checkpoint1,
            status_30d: c.status30,
            checkpoint_90d: c.dates.checkpoint2,
            status_90d: c.status60,
            avaliador: c.probationTracking?.avaliador ?? c.manager?.name ?? "",
          }))}
          columns={[
            { key: "nome", label: "Nome" },
            { key: "matricula", label: "Matrícula" },
            { key: "cargo", label: "Cargo" },
            { key: "setor", label: "Setor" },
            { key: "gestor", label: "Gestor" },
            { key: "admissao", label: "Admissão" },
            { key: "checkpoint_30d", label: "Checkpoint 30d" },
            { key: "status_30d", label: "Status 30d" },
            { key: "checkpoint_90d", label: "Checkpoint 90d" },
            { key: "status_90d", label: "Status 90d" },
            { key: "avaliador", label: "Avaliador" },
          ]}
        />
        <CardContent>
          {candidates.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum colaborador em período de experiência no momento (admitido nos últimos ~90 dias).
            </p>
          ) : (
            <ProbationTable rows={candidates} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
