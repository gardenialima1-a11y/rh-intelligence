import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { ProbationFormDialog } from "@/components/admin/probation-form-dialog";
import { computeProbationDates, resolveDisplayStatus, computeProbationAlert, type StoredProbationStatus } from "@/lib/analytics/probation";
import { formatDate } from "@/lib/utils";

interface ProbationRow {
  id: string;
  name: string;
  registration: string;
  admissionDate: Date;
  isActive?: boolean;
  position: { name: string } | null;
  costCenter: { name: string } | null;
  manager: { name: string } | null;
  probationTracking: {
    avaliador: string | null;
    status30: string;
    status60: string;
    notes: string | null;
  } | null;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "APROVADO") return <Badge variant="success">Aprovado</Badge>;
  if (status === "REPROVADO") return <Badge variant="danger">Reprovado</Badge>;
  if (status === "PRAZO_EXPIRADO_NAO_AVALIADO") return <Badge variant="danger">Prazo expirado — não avaliado</Badge>;
  return <Badge variant="outline">Em avaliação</Badge>;
}

function PrazoBadge({ diasRestantes, alerta }: { diasRestantes: number; alerta: boolean }) {
  if (alerta) {
    return (
      <Badge variant="warning">
        {diasRestantes === 0 ? "Vence hoje" : `Faltam ${diasRestantes} dia${diasRestantes === 1 ? "" : "s"}`}
      </Badge>
    );
  }
  if (diasRestantes < 0) return <Badge variant="outline">Prazo encerrado</Badge>;
  return <span className="text-xs text-muted-foreground">{diasRestantes} dias restantes</span>;
}

export function ProbationTable({ rows, variant = "andamento" }: { rows: ProbationRow[]; variant?: "andamento" | "historico" }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Colaborador</TableHead>
          <TableHead>Cargo</TableHead>
          <TableHead>Setor</TableHead>
          <TableHead>Gestor</TableHead>
          <TableHead>Admissão</TableHead>
          <TableHead>Checkpoint 30d</TableHead>
          <TableHead>Checkpoint final (90d)</TableHead>
          {variant === "andamento" && <TableHead>Prazo</TableHead>}
          {variant === "historico" && <TableHead>Situação</TableHead>}
          <TableHead>Avaliador</TableHead>
          <TableHead>Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => {
          const dates = computeProbationDates(r.admissionDate);
          const status30 = resolveDisplayStatus((r.probationTracking?.status30 ?? "EM_AVALIACAO") as StoredProbationStatus, dates.checkpoint1);
          const status60 = resolveDisplayStatus((r.probationTracking?.status60 ?? "EM_AVALIACAO") as StoredProbationStatus, dates.checkpoint2);
          const { diasRestantes, alerta } = computeProbationAlert(dates.checkpoint2, status60);

          return (
            <TableRow key={r.id}>
              <TableCell>{r.name}</TableCell>
              <TableCell>{r.position?.name ?? "—"}</TableCell>
              <TableCell>{r.costCenter?.name ?? "—"}</TableCell>
              <TableCell>{r.manager?.name ?? "—"}</TableCell>
              <TableCell>{formatDate(r.admissionDate)}</TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">{formatDate(dates.checkpoint1)}</span>
                  <StatusBadge status={status30} />
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">{formatDate(dates.checkpoint2)}</span>
                  <StatusBadge status={status60} />
                </div>
              </TableCell>
              {variant === "andamento" && (
                <TableCell>
                  <PrazoBadge diasRestantes={diasRestantes} alerta={alerta} />
                </TableCell>
              )}
              {variant === "historico" && (
                <TableCell>
                  {r.isActive === false ? (
                    <Badge variant="outline">Inativo</Badge>
                  ) : (
                    <Badge variant="success">Ativo</Badge>
                  )}
                </TableCell>
              )}
              <TableCell>{r.probationTracking?.avaliador ?? r.manager?.name ?? "—"}</TableCell>
              <TableCell>
                <ProbationFormDialog
                  employeeId={r.id}
                  employeeName={r.name}
                  managerName={r.manager?.name ?? null}
                  defaultValues={{
                    avaliador: r.probationTracking?.avaliador ?? r.manager?.name ?? null,
                    status30: (r.probationTracking?.status30 as "EM_AVALIACAO" | "APROVADO" | "REPROVADO") ?? "EM_AVALIACAO",
                    status60: (r.probationTracking?.status60 as "EM_AVALIACAO" | "APROVADO" | "REPROVADO") ?? "EM_AVALIACAO",
                    notes: r.probationTracking?.notes ?? null,
                  }}
                />
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
