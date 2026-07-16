"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Pencil, User, Search } from "lucide-react";
import { EmployeeFormDialog, type EmployeeFormOptions } from "@/components/admin/employee-form-dialog";
import { TerminationDialog } from "@/components/admin/termination-dialog";
import { formatDate } from "@/lib/utils";

const ALL = "__all__";

interface EmployeeRow {
  id: string;
  registration: string;
  name: string;
  gender: string;
  phone: string | null;
  email: string | null;
  photoUrl: string | null;
  admissionDate: Date;
  terminationDate: Date | null;
  contractType: string;
  contractEndDate: Date | null;
  isActive: boolean;
  isPCD: boolean;
  isTrustPosition: boolean;
  birthDate: Date | null;
  position: { id: string; name: string } | null;
  costCenter: { id: string; name: string } | null;
  secondaryCostCenter: { id: string; name: string } | null;
  manager: { id: string; name: string } | null;
  unit: { id: string; name: string };
}

function Avatar({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt={name} className="h-11 w-11 shrink-0 rounded-full object-cover" />;
  }
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy/10 text-navy dark:bg-cream/10 dark:text-cream">
      <User className="h-5 w-5" />
    </div>
  );
}

const STICKY_HEAD = "sticky left-0 z-20 bg-muted/70 backdrop-blur-sm";
const STICKY_CELL = "sticky left-0 z-[1] bg-card";

export function EmployeesTable({
  employees,
  options,
  reasons,
}: {
  employees: EmployeeRow[];
  options: EmployeeFormOptions;
  reasons: { id: string; label: string }[];
}) {
  const [search, setSearch] = React.useState("");
  const [setorFilter, setSetorFilter] = React.useState(ALL);
  const [setorSecundarioFilter, setSetorSecundarioFilter] = React.useState(ALL);

  const filtered = employees.filter((e) => {
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matches = e.name.toLowerCase().includes(q) || e.registration.toLowerCase().includes(q) || (e.position?.name.toLowerCase().includes(q) ?? false);
      if (!matches) return false;
    }
    if (setorFilter !== ALL && e.costCenter?.id !== setorFilter) return false;
    if (setorSecundarioFilter !== ALL && e.secondaryCostCenter?.id !== setorSecundarioFilter) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 px-1">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nome, matrícula ou cargo..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={setorFilter} onValueChange={setSetorFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Setor principal" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os setores</SelectItem>
            {options.costCenters.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={setorSecundarioFilter} onValueChange={setSetorSecundarioFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Setor secundário" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos (secundário)</SelectItem>
            {options.costCenters.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} de {employees.length}</span>
      </div>

      <Table containerClassName="max-h-[65vh]">
        <TableHeader>
          <TableRow>
            <TableHead className={STICKY_HEAD}>Colaborador</TableHead>
            <TableHead>Setor</TableHead>
            <TableHead>Setor secundário</TableHead>
            <TableHead>Matrícula</TableHead>
            <TableHead>Cargo</TableHead>
            <TableHead>Unidade</TableHead>
            <TableHead>Gestor</TableHead>
            <TableHead>Telefone</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Admissão</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((e) => (
            <TableRow key={e.id}>
              <TableCell className={STICKY_CELL}>
                <div className="flex items-center gap-2.5">
                  <Avatar name={e.name} photoUrl={e.photoUrl} />
                  <span className="font-medium">{e.name}</span>
                </div>
              </TableCell>
              <TableCell>
                {e.costCenter?.name ? <Badge variant="gold">{e.costCenter.name}</Badge> : "—"}
              </TableCell>
              <TableCell>
                {e.secondaryCostCenter?.name ? <Badge variant="outline">{e.secondaryCostCenter.name}</Badge> : "—"}
              </TableCell>
              <TableCell>{e.registration}</TableCell>
              <TableCell>{e.position?.name ?? "—"}</TableCell>
              <TableCell>{e.unit.name}</TableCell>
              <TableCell>{e.manager?.name ?? "—"}</TableCell>
              <TableCell>{e.phone ?? "—"}</TableCell>
              <TableCell>{e.email ?? "—"}</TableCell>
              <TableCell>{formatDate(e.admissionDate)}</TableCell>
              <TableCell>
                {e.isActive ? <Badge variant="success">Ativo</Badge> : <Badge variant="outline">Desligado</Badge>}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <EmployeeFormDialog
                    mode="edit"
                    employeeId={e.id}
                    options={options}
                    defaultValues={{
                      registration: e.registration,
                      name: e.name,
                      positionId: e.position?.id ?? null,
                      costCenterId: e.costCenter?.id ?? null,
                      secondaryCostCenterId: e.secondaryCostCenter?.id ?? null,
                      managerId: e.manager?.id ?? null,
                      unitId: e.unit.id,
                      gender: e.gender as "MASCULINO" | "FEMININO" | "NAO_INFORMADO",
                      phone: e.phone,
                      email: e.email,
                      photoUrl: e.photoUrl,
                      birthDate: e.birthDate ? e.birthDate.toISOString().slice(0, 10) : null,
                      admissionDate: e.admissionDate.toISOString().slice(0, 10),
                      contractType: e.contractType as "CLT" | "PJ" | "APRENDIZ" | "ESTAGIO" | "TEMPORARIO",
                      contractEndDate: e.contractEndDate ? e.contractEndDate.toISOString().slice(0, 10) : null,
                      isPCD: e.isPCD,
                      isTrustPosition: e.isTrustPosition,
                    }}
                    trigger={
                      <Button variant="outline" size="sm">
                        <Pencil className="h-3.5 w-3.5" /> Editar
                      </Button>
                    }
                  />
                  {e.isActive && <TerminationDialog employeeId={e.id} employeeName={e.name} reasons={reasons} />}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
