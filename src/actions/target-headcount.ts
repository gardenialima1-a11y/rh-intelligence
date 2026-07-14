"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/actions/employees";

const ALLOWED_ROLES = ["ADMINISTRADOR", "RH"];

async function requireHrAccess() {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    throw new Error("Você não tem permissão para editar o quadro ideal.");
  }
}

export async function updateTargetHeadcount(costCenterId: string, value: number | null): Promise<ActionResult> {
  try {
    await requireHrAccess();
    if (value !== null && (Number.isNaN(value) || value < 0)) {
      return { success: false, error: "Informe um número válido (0 ou mais)." };
    }
    await prisma.costCenter.update({ where: { id: costCenterId }, data: { targetHeadcount: value } });
    revalidatePath("/modulos/headcount");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao salvar." };
  }
}
