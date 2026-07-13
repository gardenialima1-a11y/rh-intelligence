"use client";

import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, User } from "lucide-react";
import { EmployeeFormDialog, type EmployeeFormOptions } from "@/components/admin/employee-form-dialog";
import { TerminationDialog } from "@/components/admin/termination-dialog";
import { formatDate } from "@/lib/utils";

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
    return <img src={photoUrl} alt={name} className="h-8 w-8 shrink-0 rounded-full object-cover" />;
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy/10 text-navy dark:bg-cream/10 dark:text-cream">
      <User className="h-4 w-4" />
    </div>
  );
}

export function EmployeesTable({
  employees,
  options,
  reasons,
}: {
  employees: EmployeeRow[];
  options: EmployeeFormOptions;
  reasons: { id: string; label: string }[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Colaborador</TableHead>
          <TableHead>Matrícula</TableHead>
          <TableHead>Cargo</TableHead>
          <TableHead>Setor</TableHead>
          <TableHead>Setor secundário</TableHead>
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
        {employees.map((e) => (
          <TableRow key={e.id}>
            <TableCell>
              <div className="flex items-center gap-2.5">
                <Avatar name={e.name} photoUrl={e.photoUrl} />
                <span className="font-medium">{e.name}</span>
              </div>
            </TableCell>
            <TableCell>{e.registration}</TableCell>
            <TableCell>{e.position?.name ?? "—"}</TableCell>
            <TableCell>{e.costCenter?.name ?? "—"}</TableCell>
            <TableCell>{e.secondaryCostCenter?.name ?? "—"}</TableCell>
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
  );
}
