"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2 } from "lucide-react";
import { InssLeaveFormDialog } from "@/components/admin/inss-leave-form-dialog";
import { deleteInssLeave } from "@/actions/inss-leave";
import { calculateInssLeaveDuration } from "@/lib/analytics/inss-leave";
import { formatDate } from "@/lib/utils";

interface LeaveRow {
  id: string;
  cid: string;
  startDate: Date;
  expectedReturnDate: Date | null;
  actualReturnDate: Date | null;
  notes: string | null;
  employee: { id: string; name: string; registration: string };
}

export function InssLeavesTable({ leaves, employees }: { leaves: LeaveRow[]; employees: { id: string; name: string }[] }) {
  const router = useRouter();

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir este afastamento?")) return;
    await deleteInssLeave(id);
    router.refresh();
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Colaborador</TableHead>
          <TableHead>CID</TableHead>
          <TableHead>Data de saída</TableHead>
          <TableHead>Previsão de retorno</TableHead>
          <TableHead>Dias afastado</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Observações</TableHead>
          <TableHead>Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {leaves.map((l) => {
          const duration = calculateInssLeaveDuration(l);
          return (
            <TableRow key={l.id}>
              <TableCell>{l.employee.name}</TableCell>
              <TableCell>
                <Badge variant="outline">{l.cid}</Badge>
              </TableCell>
              <TableCell>{formatDate(l.startDate)}</TableCell>
              <TableCell>{l.expectedReturnDate ? formatDate(l.expectedReturnDate) : "—"}</TableCell>
              <TableCell>{duration.daysAway}d</TableCell>
              <TableCell>
                {duration.isOngoing ? <Badge variant="danger">Afastado</Badge> : <Badge variant="success">Retornou</Badge>}
              </TableCell>
              <TableCell className="max-w-[240px] whitespace-normal text-xs text-muted-foreground">
                {l.notes || "—"}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <InssLeaveFormDialog
                    mode="edit"
                    leaveId={l.id}
                    employees={employees}
                    defaultValues={{
                      employeeId: l.employee.id,
                      cid: l.cid,
                      startDate: l.startDate.toISOString().slice(0, 10),
                      expectedReturnDate: l.expectedReturnDate ? l.expectedReturnDate.toISOString().slice(0, 10) : null,
                      actualReturnDate: l.actualReturnDate ? l.actualReturnDate.toISOString().slice(0, 10) : null,
                      notes: l.notes,
                    }}
                    trigger={
                      <Button variant="outline" size="sm">
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </Button>
                    }
                  />
                  <Button variant="outline" size="sm" onClick={() => handleDelete(l.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
