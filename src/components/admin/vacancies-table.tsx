"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, FileBarChart } from "lucide-react";
import { VacancyFormDialog } from "@/components/admin/vacancy-form-dialog";
import { deleteVacancy } from "@/actions/vacancies";
import { calculateVacancySla } from "@/lib/analytics/vacancy-sla";

const STATUS_LABEL: Record<string, string> = {
  ABERTA: "Aberta",
  EM_ANDAMENTO: "Em andamento",
  PREENCHIDA: "Preenchida",
  CANCELADA: "Cancelada",
  EM_PAUSA: "Em pausa",
};

const STATUS_VARIANT: Record<string, "success" | "warning" | "danger" | "outline" | "gold"> = {
  ABERTA: "gold",
  EM_ANDAMENTO: "warning",
  PREENCHIDA: "success",
  CANCELADA: "outline",
  EM_PAUSA: "outline",
};

interface VacancyRow {
  id: string;
  title: string;
  status: "ABERTA" | "EM_ANDAMENTO" | "PREENCHIDA" | "CANCELADA" | "EM_PAUSA";
  isCritical: boolean;
  targetDays: number;
  openedAt: Date;
  closedAt: Date | null;
  notes: string | null;
  position: { id: string; name: string } | null;
  unit: { id: string; name: string } | null;
}

export function VacanciesTable({
  vacancies,
  positions,
  units,
}: {
  vacancies: VacancyRow[];
  positions: { id: string; name: string }[];
  units: { id: string; name: string }[];
}) {
  const router = useRouter();

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir esta vaga?")) return;
    await deleteVacancy(id);
    router.refresh();
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Vaga</TableHead>
          <TableHead>Unidade</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Dias em aberto</TableHead>
          <TableHead>SLA (meta)</TableHead>
          <TableHead>Crítica</TableHead>
          <TableHead>Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {vacancies.map((v) => {
          const sla = calculateVacancySla(v);
          return (
            <TableRow key={v.id}>
              <TableCell>{v.title}</TableCell>
              <TableCell>{v.unit?.name ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[v.status]}>{STATUS_LABEL[v.status]}</Badge>
              </TableCell>
              <TableCell className="numeric">{sla.daysElapsed}</TableCell>
              <TableCell>
                {sla.isBreached ? (
                  <Badge variant="danger">Estourado (meta {v.targetDays}d)</Badge>
                ) : (
                  <Badge variant="success">Dentro do prazo (meta {v.targetDays}d)</Badge>
                )}
              </TableCell>
              <TableCell>{v.isCritical ? <Badge variant="danger">Sim</Badge> : "—"}</TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <VacancyFormDialog
                    mode="edit"
                    vacancyId={v.id}
                    positions={positions}
                    units={units}
                    defaultValues={{
                      title: v.title,
                      positionId: v.position?.id ?? null,
                      unitId: v.unit?.id ?? null,
                      status: v.status,
                      isCritical: v.isCritical,
                      targetDays: v.targetDays,
                      openedAt: v.openedAt.toISOString().slice(0, 10),
                      closedAt: v.closedAt ? v.closedAt.toISOString().slice(0, 10) : null,
                      notes: v.notes,
                    }}
                    trigger={
                      <Button variant="outline" size="sm">
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </Button>
                    }
                  />
                  <Button variant="outline" size="sm" onClick={() => handleDelete(v.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                  <a href={"/relatorios/vaga/" + v.id} target="_blank" rel="noopener noreferrer" title="Emitir relatorio da vaga" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-gold hover:text-gold-text">
                    <FileBarChart className="h-3.5 w-3.5" />
                  </a>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
