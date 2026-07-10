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
          <TableHead>Motivo</TableHead>
          <TableHead>CID</TableHead>
          <TableHead>Horas perdidas</TableHead>
          <TableHead>Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {absences.map((a) => (
          <TableRow key={a.id}>
            <TableCell>{a.employee.name}</TableCell>
            <TableCell>{formatDate(a.date)}</TableCell>
            <TableCell>{a.reason?.label ?? "—"}</TableCell>
            <TableCell>{a.cid ? <Badge variant="outline">{a.cid}</Badge> : "—"}</TableCell>
            <TableCell>{a.hoursLost}h</TableCell>
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
