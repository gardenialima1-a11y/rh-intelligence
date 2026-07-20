"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { AbsenceFormDialog } from "@/components/admin/absence-form-dialog";
import { deleteAbsence } from "@/actions/absences";
import { formatDate } from "@/lib/utils";

interface AbsenceRow {
  id: string;
  date: Date;
  hoursLost: number;
  cid: string | null;
  hasCertificate: boolean;
  absenceType: string | null;
  returnDate: Date | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
  employee: { id: string; name: string };
  reason: { id: string; label: string } | null;
}

export function AtestadosTable({
  absences,
  employees,
  reasons,
}: {
  absences: AbsenceRow[];
  employees: { id: string; name: string }[];
  reasons: { id: string; label: string }[];
}) {
  const router = useRouter();

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir este atestado?")) return;
    await deleteAbsence(id);
    router.refresh();
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Colaborador</TableHead>
          <TableHead>Data</TableHead>
          <TableHead>Retorno</TableHead>
          <TableHead>Motivo</TableHead>
          <TableHead>CID</TableHead>
          <TableHead>Horas perdidas</TableHead>
          <TableHead>Anexo</TableHead>
          <TableHead>Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {absences.map((a) => (
          <TableRow key={a.id}>
            <TableCell>{a.employee.name}</TableCell>
            <TableCell>{formatDate(a.date)}</TableCell>
            <TableCell>{a.returnDate ? formatDate(a.returnDate) : a.absenceType === "INDETERMINADO" ? "A definir" : "—"}</TableCell>
            <TableCell>{a.reason?.label ?? "—"}</TableCell>
            <TableCell>{a.cid ? <Badge variant="outline">{a.cid}</Badge> : "—"}</TableCell>
            <TableCell>{a.hoursLost}h</TableCell>
            <TableCell>
              {a.attachmentUrl ? (
                <a href={a.attachmentUrl} download={a.attachmentName ?? "atestado"} className="text-xs font-medium text-navy underline dark:text-cream">
                  Ver anexo
                </a>
              ) : (
                "—"
              )}
            </TableCell>
            <TableCell>
              <div className="flex gap-2">
                <AbsenceFormDialog
                  mode="edit"
                  absenceId={a.id}
                  employees={employees}
                  reasons={reasons}
                  defaultValues={{
                    employeeId: a.employee.id,
                    date: a.date.toISOString().slice(0, 10),
                    reasonId: a.reason?.id ?? null,
                    cid: a.cid,
                    hoursLost: a.hoursLost,
                    hasCertificate: a.hasCertificate,
                    absenceType: (a.absenceType as "ALGUMAS_HORAS" | "DIA_PARCIAL" | "UM_DIA_OU_MAIS" | "INDETERMINADO") ?? "UM_DIA_OU_MAIS",
                    returnDate: a.returnDate ? a.returnDate.toISOString().slice(0, 10) : null,
                    attachmentUrl: a.attachmentUrl,
                    attachmentName: a.attachmentName,
                  }}
                  trigger={
                    <Button variant="outline" size="sm">
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Button>
                  }
                />
                <Button variant="outline" size="sm" onClick={() => handleDelete(a.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
