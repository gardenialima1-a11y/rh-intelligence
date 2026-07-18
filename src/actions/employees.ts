"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MovementType } from "@prisma/client";
import { employeeFormSchema, terminationFormSchema, parseSalaryValue } from "@/lib/validation/employee";

const ALLOWED_ROLES = ["ADMINISTRADOR", "RH"];

async function requireHrAccess() {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    throw new Error("Você não tem permissão para gerenciar colaboradores.");
  }
  return session;
}

export interface ActionResult {
  success: boolean;
  error?: string;
}

export async function createEmployee(raw: unknown): Promise<ActionResult> {
  try {
    await requireHrAccess();
    const parsed = employeeFormSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    }
    const data = parsed.data;

    const existing = await prisma.employee.findUnique({ where: { registration: data.registration } });
    if (existing) {
      return { success: false, error: "Já existe um colaborador com essa matrícula." };
    }

    const employee = await prisma.employee.create({
      data: {
        registration: data.registration,
        name: data.name,
        positionId: data.positionId || null,
        costCenterId: data.costCenterId || null,
        secondaryCostCenterId: data.secondaryCostCenterId || null,
        managerId: data.managerId || null,
        unitId: data.unitId,
        gender: data.gender,
        phone: data.phone || null,
        email: data.email || null,
        photoUrl: data.photoUrl || null,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        admissionDate: new Date(data.admissionDate),
        contractType: data.contractType,
        contractEndDate: data.contractEndDate ? new Date(data.contractEndDate) : null,
        isPCD: data.isPCD,
        isTrustPosition: data.isTrustPosition,
        isExemptFromCatraca: data.isExemptFromCatraca,
        isActive: true,
      },
    });

    await prisma.movement.create({
      data: { date: employee.admissionDate, employeeId: employee.id, type: MovementType.ADMISSAO },
    });

    if (parseSalaryValue(data.baseSalary) !== null) {
      const salary = parseSalaryValue(data.baseSalary)!;
      const competence = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const benefitsCost = salary * 0.18;
      const chargesCost = salary * 0.42;
      await prisma.payrollEntry.create({
        data: {
          employeeId: employee.id,
          competence,
          baseSalary: salary,
          benefitsCost,
          chargesCost,
          totalCost: salary + benefitsCost + chargesCost,
        },
      });
    }

    revalidatePath("/modulos/colaboradores");
    revalidatePath("/modulos/headcount");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao criar colaborador." };
  }
}

export async function updateEmployee(employeeId: string, raw: unknown): Promise<ActionResult> {
  try {
    await requireHrAccess();
    const parsed = employeeFormSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    }
    const data = parsed.data;

    const duplicate = await prisma.employee.findFirst({
      where: { registration: data.registration, NOT: { id: employeeId } },
    });
    if (duplicate) {
      return { success: false, error: "Já existe outro colaborador com essa matrícula." };
    }

    await prisma.employee.update({
      where: { id: employeeId },
      data: {
        registration: data.registration,
        name: data.name,
        positionId: data.positionId || null,
        costCenterId: data.costCenterId || null,
        secondaryCostCenterId: data.secondaryCostCenterId || null,
        managerId: data.managerId || null,
        unitId: data.unitId,
        gender: data.gender,
        birthDate: data.birthDate ? new Date(data.birthDate) : null,
        phone: data.phone || null,
        email: data.email || null,
        photoUrl: data.photoUrl || null,
        admissionDate: new Date(data.admissionDate),
        contractType: data.contractType,
        contractEndDate: data.contractEndDate ? new Date(data.contractEndDate) : null,
        isPCD: data.isPCD,
        isTrustPosition: data.isTrustPosition,
        isExemptFromCatraca: data.isExemptFromCatraca,
      },
    });

    revalidatePath("/modulos/colaboradores");
    revalidatePath("/modulos/headcount");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao atualizar colaborador." };
  }
}

export async function deactivateEmployee(employeeId: string, raw: unknown): Promise<ActionResult> {
  try {
    await requireHrAccess();
    const parsed = terminationFormSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    }
    const data = parsed.data;

    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) return { success: false, error: "Colaborador não encontrado." };
    if (!employee.isActive) return { success: false, error: "Este colaborador já está desligado." };

    const terminationDate = new Date(data.terminationDate);

    await prisma.employee.update({
      where: { id: employeeId },
      data: { isActive: false, terminationDate },
    });

    await prisma.movement.create({
      data: {
        date: terminationDate,
        employeeId,
        type: MovementType.DESLIGAMENTO,
        voluntary: data.voluntary,
        reasonId: data.reasonId || null,
        costValue: parseSalaryValue(data.costValue),
        notes: data.notes || null,
      },
    });

    revalidatePath("/modulos/colaboradores");
    revalidatePath("/modulos/headcount");
    revalidatePath("/modulos/turnover");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao desligar colaborador." };
  }
}

export interface BulkImportSummary {
  created: number;
  skipped: { rowNumber: number; registration: string; reason: string }[];
}

export async function bulkImportEmployees(rows: import("@/lib/validation/bulk-import").RowResult[]): Promise<{ success: boolean; summary?: BulkImportSummary; error?: string }> {
  try {
    await requireHrAccess();

    const validRows = rows.filter((r) => r.data !== null);
    if (validRows.length === 0) {
      return { success: false, error: "Nenhuma linha válida para importar." };
    }

    const registrations = validRows.map((r) => r.data!.registration);
    const existing = await prisma.employee.findMany({
      where: { registration: { in: registrations } },
      select: { registration: true },
    });
    const existingSet = new Set(existing.map((e) => e.registration));

    const summary: BulkImportSummary = { created: 0, skipped: [] };

    for (const row of validRows) {
      const data = row.data!;
      if (existingSet.has(data.registration)) {
        summary.skipped.push({ rowNumber: row.rowNumber, registration: data.registration, reason: "Matrícula já cadastrada" });
        continue;
      }
      try {
        const employee = await prisma.employee.create({
          data: {
            registration: data.registration,
            name: data.name,
            positionId: data.positionId,
            costCenterId: data.costCenterId,
            secondaryCostCenterId: data.secondaryCostCenterId,
            managerId: data.managerId,
            unitId: data.unitId,
            gender: data.gender,
            phone: data.phone,
            email: data.email,
            birthDate: data.birthDate ? new Date(data.birthDate) : null,
            admissionDate: new Date(data.admissionDate),
            contractType: data.contractType,
            isPCD: data.isPCD,
            isActive: true,
          },
        });
        await prisma.movement.create({
          data: { date: employee.admissionDate, employeeId: employee.id, type: MovementType.ADMISSAO },
        });
        if (data.baseSalary !== null) {
          const competence = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
          const benefitsCost = data.baseSalary * 0.18;
          const chargesCost = data.baseSalary * 0.42;
          await prisma.payrollEntry.create({
            data: {
              employeeId: employee.id,
              competence,
              baseSalary: data.baseSalary,
              benefitsCost,
              chargesCost,
              totalCost: data.baseSalary + benefitsCost + chargesCost,
            },
          });
        }
        summary.created += 1;
        existingSet.add(data.registration);
      } catch (err) {
        summary.skipped.push({
          rowNumber: row.rowNumber,
          registration: data.registration,
          reason: err instanceof Error ? err.message : "Erro desconhecido ao criar",
        });
      }
    }

    revalidatePath("/modulos/colaboradores");
    revalidatePath("/modulos/headcount");
    revalidatePath("/");
    return { success: true, summary };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao importar planilha." };
  }
}

export async function getEmployeesForAdmin() {
  await requireHrAccess();
  return prisma.employee.findMany({
    include: { position: true, costCenter: true, secondaryCostCenter: true, manager: true, unit: true },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}

export async function getEmployeeFormOptions() {
  await requireHrAccess();
  const [positions, costCenters, managers, units, reasons, employeeOptions] = await Promise.all([
    prisma.position.findMany({ orderBy: { name: "asc" } }),
    prisma.costCenter.findMany({ orderBy: { name: "asc" } }),
    prisma.manager.findMany({ orderBy: { name: "asc" } }),
    prisma.unit.findMany({ orderBy: { name: "asc" } }),
    prisma.reason.findMany({ where: { category: "TURNOVER" }, orderBy: { label: "asc" } }),
    prisma.employee.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return { positions, costCenters, managers, units, reasons, employeeOptions };
}
