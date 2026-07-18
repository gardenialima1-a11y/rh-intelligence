"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { complianceFormSchema, parseEstimatedCost } from "@/lib/validation/compliance";
import type { ActionResult } from "@/actions/employees";

const ALLOWED_ROLES = ["ADMINISTRADOR", "RH"];

async function requireHrAccess() {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    throw new Error("Você não tem permissão para registrar medidas disciplinares.");
  }
}

export async function createComplianceEvent(raw: unknown): Promise<ActionResult> {
  try {
    await requireHrAccess();
    const parsed = complianceFormSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    const data = parsed.data;

    // Motivo é digitado livremente. Reaproveita um "Reason" já existente com
    // o mesmo texto (para os gráficos por motivo agruparem certinho) ou cria
    // um novo na hora.
    const reason = await prisma.reason.upsert({
      where: { category_label: { category: "ADVERTENCIA", label: data.motivo } },
      create: { category: "ADVERTENCIA", label: data.motivo },
      update: {},
    });

    await prisma.complianceEvent.create({
      data: {
        employeeId: data.employeeId,
        type: data.type,
        date: new Date(data.date),
        reasonId: reason.id,
        estimatedCost: parseEstimatedCost(data.estimatedCost),
      },
    });

    revalidatePath("/modulos/compliance");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao registrar medida disciplinar." };
  }
}

export async function deleteComplianceEvent(id: string): Promise<ActionResult> {
  try {
    await requireHrAccess();
    await prisma.complianceEvent.delete({ where: { id } });
    revalidatePath("/modulos/compliance");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao excluir registro." };
  }
}
