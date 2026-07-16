import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmployeeFormDialog } from "@/components/admin/employee-form-dialog";
import { EmployeesTable } from "@/components/admin/employees-table";
import { BulkImportDialog } from "@/components/admin/bulk-import-dialog";
import { BulkPhotoUploadDialog } from "@/components/admin/bulk-photo-upload-dialog";
import { getEmployeesForAdmin, getEmployeeFormOptions } from "@/actions/employees";

const ALLOWED_ROLES = ["ADMINISTRADOR", "RH"];

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
