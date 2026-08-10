import { UserCheck, AlertTriangle, Clock3, FileDown } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { TableCardHeader } from "@/components/dashboard/table-card-header";
import { ProbationTable } from "@/components/admin/probation-table";
import { getProbationOverview } from "@/actions/probation";
import { formatNumber } from "@/lib/utils";

export default async function PeriodoExperienciaPage() {
  const { emAndamento, historico } = await getProbationOverview();

  const emAlerta = emAndamento.filter((c) => c.alerta).length;
  const expiredNotEvaluated = emAndamento.filter((c) => c.status30 === "PRAZO_EXPIRADO_NAO_AVALIADO" || c.status60 === "PRAZO_EXPIRADO_NAO_AVALIADO").length;
  const inProgress = emAndamento.filter((c) => c.status60 === "EM_AVALIACAO").length;

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader
        title="Período de Experiência"
        description="Colaboradores nos primeiros 90 dias (30 + 60), com checkpoints calculados a partir da data real de admissão."
        moduleKey="periodo-experiencia"
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Em período de experiência" value={formatNumber(emAndamento.length)} icon={UserCheck} accent="navy" />
        <KpiCard label="Ainda em avaliação" value={formatNumber(inProgress)} icon={UserCheck} accent="gold" />
        <KpiCard label="Prazo vencendo (≤10 dias)" value={formatNumber(emAlerta)} icon={Clock3} accent="gold" />
        <KpiCard label="Prazo expirado sem avaliação" value={formatNumber(expiredNotEvaluated)} icon={AlertTriangle} accent="danger" />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div className="flex flex-col gap-1">
            <CardTitle>Acompanhamento — em andamento</CardTitle>
            <p className="text-xs text-muted-foreground">
              Sai automaticamente desta lista assim que completa os 90 dias (o histórico continua disponível
              abaixo). Linhas em destaque estão a 10 dias ou menos do prazo final.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <a href="/api/reports/periodo-experiencia" download>
              <FileDown className="h-3.5 w-3.5" />
              Baixar PDF pra diretoria
            </a>
          </Button>
        </CardHeader>
        <CardContent>
          {emAndamento.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum colaborador em período de experiência no momento.
            </p>
          ) : (
            <ProbationTable rows={emAndamento} variant="andamento" showManagerFilter />
          )}
        </CardContent>
      </Card>

      <Card>
        <TableCardHeader
          title="Histórico"
          filename="periodo-experiencia-historico"
          data={historico.map((c) => ({
            nome: c.name,
            matricula: c.registration,
            cargo: c.position?.name ?? "",
            setor: c.costCenter?.name ?? "",
            gestor: c.manager?.name ?? "",
            admissao: c.admissionDate,
            checkpoint_90d: c.dates.checkpoint2,
            status_90d: c.status60,
            fora_do_prazo_90d: c.probationTracking?.foraDoPrazo60 ? "Sim" : "Não",
            situacao_atual: c.isActive ? "Ativo" : "Inativo",
            avaliador: c.probationTracking?.avaliador ?? c.manager?.name ?? "",
          }))}
          columns={[
            { key: "nome", label: "Nome" },
            { key: "matricula", label: "Matrícula" },
            { key: "cargo", label: "Cargo" },
            { key: "setor", label: "Setor" },
            { key: "gestor", label: "Gestor" },
            { key: "admissao", label: "Admissão" },
            { key: "checkpoint_90d", label: "Checkpoint 90d" },
            { key: "status_90d", label: "Status 90d" },
            { key: "fora_do_prazo_90d", label: "Avaliado fora do prazo (90d)" },
            { key: "situacao_atual", label: "Situação atual" },
            { key: "avaliador", label: "Avaliador" },
          ]}
        />
        <CardContent>
          {historico.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Ninguém completou o período de experiência ainda (dentro da janela de histórico de 2 anos).
            </p>
          ) : (
            <ProbationTable rows={historico} variant="historico" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
