import { prisma } from "@/lib/prisma";

/**
 * Reúne tudo que entra no "Relatório do colaborador": dados cadastrais,
 * histórico completo de atestados e histórico completo de medidas
 * disciplinares. Usado pela página de relatório imprimível.
 */
export async function getEmployeeReportData(employeeId: string) {
  const [employee, absences, complianceEvents] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        position: true,
        unit: true,
        costCenter: true,
        secondaryCostCenter: true,
        manager: true,
      },
    }),
    prisma.absence.findMany({
      where: { employeeId },
      include: { reason: true },
      orderBy: { date: "desc" },
    }),
    prisma.complianceEvent.findMany({
      where: { employeeId },
      include: { reason: true },
      orderBy: { date: "desc" },
    }),
  ]);

  if (!employee) return null;

  const totalHoursLost = absences.reduce((acc, a) => acc + a.hoursLost, 0);
  const advertencias = complianceEvents.filter((e) => e.type === "ADVERTENCIA").length;
  const suspensoes = complianceEvents.filter((e) => e.type === "SUSPENSAO").length;
  const processos = complianceEvents.filter((e) => e.type === "PROCESSO").length;

  return {
    employee,
    absences,
    complianceEvents,
    summary: {
      totalAtestados: absences.length,
      totalHoursLost,
      advertencias,
      suspensoes,
      processos,
    },
  };
}

export type EmployeeReportData = NonNullable<Awaited<ReturnType<typeof getEmployeeReportData>>>;
