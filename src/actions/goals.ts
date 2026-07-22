"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Comparator } from "@prisma/client";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMINISTRADOR") {
    throw new Error("Você não tem permissão para gerenciar metas.");
  }
}

export async function listGoals() {
  await requireAdmin();
  return prisma.goal.findMany({ orderBy: [{ moduleKey: "asc" }, { periodYear: "desc" }] });
}

export interface GoalInput {
  id?: string;
  moduleKey: string;
  indicator: string;
  targetValue: number;
  comparator: Comparator;
  periodYear: number;
  periodMonth?: number | null;
}

/** Cria ou atualiza uma meta (se vier "id", atualiza; senão, cria uma nova). */
export async function upsertGoal(input: GoalInput): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();

    if (input.id) {
      await prisma.goal.update({
        where: { id: input.id },
        data: {
          moduleKey: input.moduleKey,
          indicator: input.indicator,
          targetValue: input.targetValue,
          comparator: input.comparator,
          periodYear: input.periodYear,
          periodMonth: input.periodMonth ?? null,
        },
      });
    } else {
      await prisma.goal.create({
        data: {
          moduleKey: input.moduleKey,
          indicator: input.indicator,
          targetValue: input.targetValue,
          comparator: input.comparator,
          periodYear: input.periodYear,
          periodMonth: input.periodMonth ?? null,
        },
      });
    }

    revalidatePath("/modulos/administracao");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao salvar meta." };
  }
}

export async function deleteGoal(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    await prisma.goal.delete({ where: { id } });
    revalidatePath("/modulos/administracao");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao apagar meta." };
  }
}
