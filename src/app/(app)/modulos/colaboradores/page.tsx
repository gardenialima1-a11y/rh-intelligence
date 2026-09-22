import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmployeeFormDialog } from "@/components/admin/employee-form-dialog";
import { EmployeesTable } from "@/components/admin/employees-table";
import { BulkImportDialog } from "@/components/admin/bulk-import-dialog";
import { BulkPhotoUploadDialog } from "@/components/admin/bulk-photo-upload-dialog";
import { ExportCsvButton } from "@/components/dashboard/export-csv-button";
import { getEmployeesForAdmin, getEmployeeFormOptions } from "@/actions/employees";

const ALLOWED_ROLES = ["ADMINISTRADOR", "RH"];

const GENDER_LABEL: Record<string, string> = { MASCULINO: "Masculino", FEMININO: "Feminino", NAO_INFORMADO: "Não informado" };
const CONTRACT_LABEL: Record<string, string> = { CLT: "CLT", PJ: "PJ", APRENDIZ: "Aprendiz", ESTAGIO: "Estágio", TEMPORARIO: "Temporário" };

export default async function ColaboradoresPage() {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    redirect("/");
  }

  const [employees, options] = await Promise.all([getEmployeesForAdmin(), getEmployeeFormOptions()]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <ModuleHeader
          title="Colaboradores"
          description="Cadastre, edite e desligue colaboradores diretamente na plataforma."
          moduleKey="colaboradores"
        />
        <div className="flex gap-2">
          <ExportCsvButton
            filename="colaboradores"
            data={employees.map((e) => ({
              matricula: e.registration,
              nome: e.name,
              cargo: e.position?.name ?? "",
              centroCusto: e.costCenter?.name ?? "",
              setorSecundario: e.secondaryCostCenter?.name ?? "",
              gestor: e.manager?.name ?? "",
              unidade: e.unit.name,
              genero: GENDER_LABEL[e.gender] ?? e.gender,
              telefone: e.phone ?? "",
              email: e.email ?? "",
              dataNascimento: e.birthDate ?? "",
              dataAdmissao: e.admissionDate,
              dataDesligamento: e.terminationDate ?? "",
              tipoContrato: CONTRACT_LABEL[e.contractType] ?? e.contractType,
              dataFimContrato: e.contractEndDate ?? "",
              pcd: e.isPCD ? "Sim" : "Não",
              cargoConfianca: e.isTrustPosition ? "Sim" : "Não",
              isentoCatraca: e.isExemptFromCatraca ? "Sim" : "Não",
              status: e.isActive ? "Ativo" : "Inativo",
            }))}
            columns={[
              { key: "matricula", label: "Matrícula" },
              { key: "nome", label: "Nome completo" },
              { key: "cargo", label: "Cargo" },
              { key: "centroCusto", label: "Centro de custo" },
              { key: "setorSecundario", label: "Setor secundário" },
              { key: "gestor", label: "Gestor" },
              { key: "unidade", label: "Unidade" },
              { key: "genero", label: "Gênero" },
              { key: "telefone", label: "Telefone" },
              { key: "email", label: "E-mail" },
              { key: "dataNascimento", label: "Data de nascimento" },
              { key: "dataAdmissao", label: "Data de admissão" },
              { key: "dataDesligamento", label: "Data de desligamento" },
              { key: "tipoContrato", label: "Tipo de contrato" },
              { key: "dataFimContrato", label: "Data fim de contrato" },
              { key: "pcd", label: "PCD" },
              { key: "cargoConfianca", label: "Cargo de confiança" },
              { key: "isentoCatraca", label: "Isento catraca" },
              { key: "status", label: "Status" },
            ]}
          />
          <BulkImportDialog
            refs={{
              positions: options.positions,
              costCenters: options.costCenters,
              managers: options.managers,
              units: options.units,
            }}
          />
          <BulkPhotoUploadDialog />
          <EmployeeFormDialog mode="create" options={options} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {employees.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Nenhum colaborador cadastrado ainda. Clique em &quot;Novo colaborador&quot; para começar.
            </p>
          ) : (
            <EmployeesTable employees={employees} options={options} reasons={options.reasons} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
