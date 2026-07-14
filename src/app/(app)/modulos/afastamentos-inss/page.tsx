import { HeartPulse, AlertTriangle } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { InssLeaveFormDialog } from "@/components/admin/inss-leave-form-dialog";
import { InssLeavesTable } from "@/components/admin/inss-leaves-table";
import { getInssLeaves } from "@/actions/inss-leave";
import { calculateInssLeaveDuration } from "@/lib/analytics/inss-leave";
import { formatNumber } from "@/lib/utils";
import { prisma } from "@/lib/prisma";

export default async function AfastamentosInssPage() {
  const [leaves, employees] = await Promise.all([
    getInssLeaves(),
    prisma.employee.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const ongoing = leaves.filter((l) => calculateInssLeaveDuration(l).isOngoing);
  const avgDays =
    ongoing.length > 0 ? Math.round(ongoing.reduce((acc, l) => acc + calculateInssLeaveDuration(l).daysAway, 0) / ongoing.length) : 0;
  const avgDaysLabel = avgDays + "d";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <ModuleHeader
          title="Afastamentos INSS"
          description="Colaboradores afastados pelo INSS: CID, data de saída, dias afastado e observações."
          moduleKey="afastamentos-inss"
        />
        <InssLeaveFormDialog employees={employees} mode="create" />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <KpiCard label="Afastados no momento" value={formatNumber(ongoing.length)} icon={HeartPulse} accent="danger" />
        <KpiCard label="Total de registros" value={formatNumber(leaves.length)} icon={AlertTriangle} accent="navy" />
        <KpiCard label="Média de dias afastado (em curso)" value={avgDaysLabel} icon={HeartPulse} accent="gold" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Afastamentos registrados</CardTitle>
        </CardHeader>
        <CardContent>
          {leaves.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum afastamento registrado ainda. Clique em &quot;Novo afastamento&quot; para começar.
            </p>
          ) : (
            <InssLeavesTable leaves={leaves} employees={employees} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
