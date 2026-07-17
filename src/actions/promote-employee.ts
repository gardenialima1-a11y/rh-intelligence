"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ActionResult } from "@/actions/employees";

const ALLOWED_ROLES = ["ADMINISTRADOR", "RH"];

async function requireHrAccess() {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    throw new Error("Você não tem permissão para promover colaboradores.");
  }
}

export async function promoteToClt(employeeId: string): Promise<ActionResult> {
  try {
    await requireHrAccess();
    await prisma.employee.update({
      where: { id: employeeId },
      data: { contractType: "CLT", contractEndDate: null },
    });
    revalidatePath("/modulos/contratos-temporarios");
    revalidatePath("/modulos/colaboradores");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao promover colaborador." };
  }
}
