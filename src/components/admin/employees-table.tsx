"use client";

import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { EmployeeFormDialog, type EmployeeFormOptions } from "@/components/admin/employee-form-dialog";
import { TerminationDialog } from "@/components/admin/termination-dialog";
import { formatDate } from "@/lib/utils";

interface EmployeeRow {
  id: string;
  registration: string;
  name: string;
  gender: string;
  admissionDate: Date;
  terminationDate: Date | null;
  contractType: string;
  isActive: boolean;
  isPCD: boolean;
  birthDate: Date | null;
  position: { id: string; name: string } | null;
  costCenter: { id: string; name: string } | null;
  secondaryCostCenter: { id: string; name: string } | null;
  manager: { id: string; name: string } | null;
  unit: { id: string; name: string };
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
          <TableHead>Matrícula</TableHead>
          <TableHead>Nome</TableHead>
          <TableHead>Cargo</TableHead>
          <TableHead>Setor</TableHead>
          <TableHead>Setor secundário</TableHead>
          <TableHead>Unidade</TableHead>
          <TableHead>Gestor</TableHead>
          <TableHead>Admissão</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {employees.map((e) => (
          <TableRow key={e.id}>
            <TableCell>{e.registration}</TableCell>
            <TableCell>{e.name}</TableCell>
            <TableCell>{e.position?.name ?? "—"}</TableCell>
            <TableCell>{e.costCenter?.name ?? "—"}</TableCell>
            <TableCell>{e.secondaryCostCenter?.name ?? "—"}</TableCell>
            <TableCell>{e.unit.name}</TableCell>
            <TableCell>{e.manager?.name ?? "—"}</TableCell>
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
                    birthDate: e.birthDate ? e.birthDate.toISOString().slice(0, 10) : null,
                    admissionDate: e.admissionDate.toISOString().slice(0, 10),
                    contractType: e.contractType as "CLT" | "PJ" | "APRENDIZ" | "ESTAGIO" | "TEMPORARIO",
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
