"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { TurnstileRowResult } from "@/lib/validation/turnstile-import";

const ALLOWED_ROLES = ["ADMINISTRADOR", "RH"];

async function requireHrAccess() {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    throw new Error("Você não tem permissão para importar dados de catraca.");
  }
}

export interface TurnstileImportSummary {
  created: number;
  skipped: number;
}

export async function getEmployeeRegistrationMap(): Promise<Record<string, string>> {
  await requireHrAccess();
  const employees = await prisma.employee.findMany({ select: { id: true, registration: true } });
  return Object.fromEntries(employees.map((e) => [e.registration, e.id]));
}

export async function bulkImportTurnstileEvents(
  rows: TurnstileRowResult[]
): Promise<{ success: boolean; summary?: TurnstileImportSummary; error?: string }> {
  try {
    await requireHrAccess();

    const validRows = rows.filter((r) => r.data !== null);
    if (validRows.length === 0) {
      return { success: false, error: "Nenhuma linha válida para importar." };
    }

    const result = await prisma.turnstileEvent.createMany({
      data: validRows.map((r) => ({
        employeeId: r.data!.employeeId,
        timestamp: r.data!.timestamp,
        direction: r.data!.direction,
        location: r.data!.location,
      })),
    });

    revalidatePath("/modulos/catraca");
    return { success: true, summary: { created: result.count, skipped: rows.length - validRows.length } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao importar relatório de catraca." };
  }
}
