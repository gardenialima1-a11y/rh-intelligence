"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Pencil, Trash2, Search, Download } from "lucide-react";
import { AbsenceFormDialog } from "@/components/admin/absence-form-dialog";
import { deleteAbsence } from "@/actions/absences";
import { formatDate } from "@/lib/utils";

const ALL = "__all__";

const MONTHS = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

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

/** Monta e baixa um CSV (separado por ; para abrir certo no Excel PT-BR) com as linhas já filtradas. */
function exportCsv(rows: AbsenceRow[]) {
  const header = ["Colaborador", "Setor secundário", "Data", "Retorno", "Motivo", "CID", "Horas perdidas"];
  const body = rows.map((a) => [
    a.employee.name,
    a.employee.secondaryCostCenter?.name ?? "",
    formatDate(a.date),
    a.returnDate ? formatDate(a.returnDate) : "",
    a.reason?.label ?? "",
    a.cid ?? "",
    String(a.hoursLost),
  ]);
  const csv = [header, ...body]
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `atestados-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
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
  const [reasonFilter, setReasonFilter] = React.useState(ALL);
  const [monthFilter, setMonthFilter] = React.useState(ALL);
  const [yearFilter, setYearFilter] = React.useState(ALL);

  const years = React.useMemo(() => {
    const set = new Set<number>();
    absences.forEach((a) => set.add(a.date.getFullYear()));
    return Array.from(set).sort((a, b) => b - a);
  }, [absences]);

  const filtered = React.useMemo(() => {
    return absences.filter((a) => {
      if (nameFilter.trim() && !a.employee.name.toLowerCase().includes(nameFilter.trim().toLowerCase())) return false;
      if (cidFilter.trim() && !(a.cid ?? "").toLowerCase().includes(cidFilter.trim().toLowerCase())) return false;
      if (setorSecundarioFilter !== ALL && a.employee.secondaryCostCenter?.id !== setorSecundarioFilter) return false;
      if (reasonFilter !== ALL && a.reason?.id !== reasonFilter) return false;
      if (monthFilter !== ALL && String(a.date.getMonth() + 1).padStart(2, "0") !== monthFilter) return false;
      if (yearFilter !== ALL && String(a.date.getFullYear()) !== yearFilter) return false;
      return true;
    });
  }, [absences, nameFilter, cidFilter, setorSecundarioFilter, reasonFilter, monthFilter, yearFilter]);

  const totalHoursFiltered = React.useMemo(() => filtered.reduce((sum, a) => sum + a.hoursLost, 0), [filtered]);

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
        <Input placeholder="CID (ex.: M54)" className="w-[140px]" value={cidFilter} onChange={(e) => setCidFilter(e.target.value)} />
        <Select value={setorSecundarioFilter} onValueChange={setSetorSecundarioFilter}>
          <SelectTrigger className="w-[190px]"><SelectValue placeholder="Setor secundário" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os setores</SelectItem>
            {costCenters.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={reasonFilter} onValueChange={setReasonFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Motivo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os motivos</SelectItem>
            {reasons.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Mês" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os meses</SelectItem>
            {MONTHS.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-[110px]"><SelectValue placeholder="Ano" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" size="sm" onClick={() => exportCsv(filtered)} disabled={filtered.length === 0}>
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} de {absences.length} atestado(s) · {totalHoursFiltered}h perdidas no filtro atual
      </p>

      <Table containerClassName="max-h-[65vh]">
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
