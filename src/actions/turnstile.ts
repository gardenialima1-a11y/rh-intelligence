"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { matchEntriesToEmployees, type ParsedTurnstileEntry } from "@/lib/validation/turnstile-import";

const ALLOWED_ROLES = ["ADMINISTRADOR", "RH"];

async function requireHrAccess() {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    throw new Error("Você não tem permissão para importar dados de catraca.");
  }
}

export interface TurnstileImportSummary {
  created: number;
  unmatchedNames: string[];
}

export async function bulkImportTurnstileEvents(
  entries: ParsedTurnstileEntry[]
): Promise<{ success: boolean; summary?: TurnstileImportSummary; error?: string }> {
  try {
    await requireHrAccess();

    if (entries.length === 0) {
      return { success: false, error: "Nenhum evento encontrado no relatório." };
    }

    const employees = await prisma.employee.findMany({ select: { id: true, name: true } });
    const { matched, unmatchedNames } = matchEntriesToEmployees(entries, employees);

    if (matched.length === 0) {
      return {
        success: false,
        error: `Nenhum nome do relatório bateu com o cadastro. Confira: ${unmatchedNames.slice(0, 5).join(", ")}`,
      };
    }

    const result = await prisma.turnstileEvent.createMany({
      data: matched.map((m) => ({
        employeeId: m.employeeId,
        timestamp: m.timestamp,
        direction: m.direction,
        location: null,
      })),
    });

    revalidatePath("/modulos/catraca");
    return { success: true, summary: { created: result.count, unmatchedNames } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao importar relatório de catraca." };
  }
}
