import { prisma } from "@/lib/prisma";
import { classifyContractExpiry } from "@/lib/analytics/contract-expiry";

export async function getFixedTermContracts() {
  const employees = await prisma.employee.findMany({
    where: { isActive: true, contractType: { in: ["APRENDIZ", "ESTAGIO", "TEMPORARIO"] } },
    select: {
      id: true,
      name: true,
      registration: true,
      contractType: true,
      admissionDate: true,
      contractEndDate: true,
      position: { select: { name: true } },
      costCenter: { select: { name: true } },
      unit: { select: { name: true } },
    },
    orderBy: { contractEndDate: "asc" },
  });

  return employees.map((e) => ({
    ...e,
    position: e.position?.name ?? null,
    costCenter: e.costCenter?.name ?? null,
    unit: e.unit.name,
    expiry: classifyContractExpiry({ contractEndDate: e.contractEndDate }),
  }));
}
