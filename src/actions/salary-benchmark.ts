"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { ActionResult } from "@/actions/employees";

const ALLOWED_ROLES = ["ADMINISTRADOR", "RH"];

async function requireHrAccess() {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    throw new Error("Você não tem permissão para gerenciar o benchmarking salarial.");
  }
}

const benchmarkSchema = z
  .object({
    positionId: z.string().min(1),
    region: z.string().trim().min(1, "Informe a região"),
    industry: z.string().trim().min(1, "Informe o setor"),
    marketMinSalary: z.coerce.number().min(0, "Valor inválido"),
    marketAvgSalary: z.coerce.number().min(0, "Valor inválido"),
    marketMaxSalary: z.coerce.number().min(0, "Valor inválido"),
    source: z.string().trim().min(1, "Informe a fonte da pesquisa"),
    referenceDate: z.string().min(1, "Informe a data da pesquisa"),
  })
  .refine((d) => d.marketMinSalary <= d.marketAvgSalary && d.marketAvgSalary <= d.marketMaxSalary, {
    message: "Os valores devem seguir: mínimo ≤ médio ≤ máximo",
    path: ["marketAvgSalary"],
  });

export async function deleteSalaryBenchmark(positionId: string): Promise<ActionResult> {
  try {
    await requireHrAccess();
    await prisma.salaryBenchmark.delete({ where: { positionId } });
    revalidatePath("/modulos/custos");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao excluir cargo do benchmarking." };
  }
}

export async function getPositionsWithoutBenchmark() {
  return prisma.position.findMany({
    where: { benchmark: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function upsertSalaryBenchmark(raw: unknown): Promise<ActionResult> {
  try {
    await requireHrAccess();
    const parsed = benchmarkSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    }
    const data = parsed.data;

    await prisma.salaryBenchmark.upsert({
      where: { positionId: data.positionId },
      create: {
        positionId: data.positionId,
        region: data.region,
        industry: data.industry,
        marketMinSalary: data.marketMinSalary,
        marketAvgSalary: data.marketAvgSalary,
        marketMaxSalary: data.marketMaxSalary,
        source: data.source,
        referenceDate: new Date(data.referenceDate),
      },
      update: {
        region: data.region,
        industry: data.industry,
        marketMinSalary: data.marketMinSalary,
        marketAvgSalary: data.marketAvgSalary,
        marketMaxSalary: data.marketMaxSalary,
        source: data.source,
        referenceDate: new Date(data.referenceDate),
      },
    });

    revalidatePath("/modulos/custos");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao salvar benchmark." };
  }
}
