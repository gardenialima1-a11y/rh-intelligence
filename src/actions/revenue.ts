"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireHrOrAdmin() {
  const session = await auth();
  if (!session?.user || !["ADMINISTRADOR", "RH"].includes(session.user.role)) {
    throw new Error("Você não tem permissão para cadastrar receita.");
  }
}

export async function listRevenueEntries() {
  await requireHrOrAdmin();
  return prisma.revenueEntry.findMany({ orderBy: { competence: "desc" }, take: 24 });
}

/** competence no formato "YYYY-MM" (ex.: "2026-06"). */
export async function upsertRevenueEntry(competence: string, amount: number): Promise<{ success: boolean; error?: string }> {
  try {
    await requireHrOrAdmin();
    if (!/^\d{4}-\d{2}$/.test(competence)) {
      return { success: false, error: "Competência inválida. Use o formato AAAA-MM." };
    }
    const date = new Date(`${competence}-01T00:00:00.000Z`);

    await prisma.revenueEntry.upsert({
      where: { competence: date },
      create: { competence: date, amount },
      update: { amount },
    });

    revalidatePath("/modulos/administracao");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao salvar receita." };
  }
}

export async function deleteRevenueEntry(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await requireHrOrAdmin();
    await prisma.revenueEntry.delete({ where: { id } });
    revalidatePath("/modulos/administracao");
    revalidatePath("/");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao apagar." };
  }
}
