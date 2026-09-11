"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Pencil, Trash2, Search } from "lucide-react";
import { AbsenceFormDialog } from "@/components/admin/absence-form-dialog";
import { deleteAbsence } from "@/actions/absences";
import { formatDate } from "@/lib/utils";

const ALL = "__all__";

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
  employee: { id: string; name: string; secondaryCostCenter: { id: string; name: string } | null };
  reason: { id: string; label: string } | null;
}

export function AtestadosTable({
  absences,
  employees,
  reasons,
  costCenters,
}: {
  absences: AbsenceRow[];
  employees: { id: string; name: string }[];
  reasons: { id: string; label: string }[];
  costCenters: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [nameFilter, setNameFilter] = React.useState("");
  const [cidFilter, setCidFilter] = React.useState("");
  const [setorSecundarioFilter, setSetorSecundarioFilter] = React.useState(ALL);

  const filtered = React.useMemo(() => {
    return absences.filter((a) => {
      if (nameFilter.trim() && !a.employee.name.toLowerCase().includes(nameFilter.trim().toLowerCase())) return false;
      if (cidFilter.trim() && !(a.cid ?? "").toLowerCase().includes(cidFilter.trim().toLowerCase())) return false;
      if (setorSecundarioFilter !== ALL && a.employee.secondaryCostCenter?.id !== setorSecundarioFilter) return false;
      return true;
    });
  }, [absences, nameFilter, cidFilter, setorSecundarioFilter]);

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir este atestado?")) return;
    await deleteAbsence(id);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por colaborador..." className="pl-8" value={nameFilter} onChange={(e) => setNameFilter(e.target.value)} />
        </div>
        <Input placeholder="CID (ex.: M54)" className="w-[160px]" value={cidFilter} onChange={(e) => setCidFilter(e.target.value)} />
        <Select value={setorSecundarioFilter} onValueChange={setSetorSecundarioFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Setor secundário" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os setores</SelectItem>
            {costCenters.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} de {absences.length}</span>
      </div>

      <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Colaborador</TableHead>
          <TableHead>Setor secundário</TableHead>
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
        {filtered.length === 0 ? (
          <TableRow>
            <TableCell colSpan={9} className="py-6 text-center text-sm text-muted-foreground">
              Nenhum atestado encontrado com esses filtros.
            </TableCell>
          </TableRow>
        ) : (
        filtered.map((a) => (
          <TableRow key={a.id}>
            <TableCell>{a.employee.name}</TableCell>
            <TableCell>{a.employee.secondaryCostCenter?.name ?? "—"}</TableCell>
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
        ))
        )}
      </TableBody>
      </Table>
    </div>
  );
}
