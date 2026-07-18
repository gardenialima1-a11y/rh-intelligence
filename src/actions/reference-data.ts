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
    throw new Error("Você não tem permissão para gerenciar cadastros.");
  }
}

const nameSchema = z.string().trim().min(2, "Informe um nome com pelo menos 2 letras");

export async function createPosition(name: string, level?: string): Promise<ActionResult> {
  try {
    await requireHrAccess();
    const parsed = nameSchema.safeParse(name);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
    await prisma.position.create({ data: { name: parsed.data, level: level || null } });
    revalidatePath("/modulos/colaboradores");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao criar cargo." };
  }
}

export async function createCostCenter(name: string, area: string): Promise<ActionResult> {
  try {
    await requireHrAccess();
    const parsedName = nameSchema.safeParse(name);
    if (!parsedName.success) return { success: false, error: parsedName.error.issues[0].message };
    const code = `CC-${Date.now().toString(36).toUpperCase()}`;
    await prisma.costCenter.create({ data: { name: parsedName.data, area: area || parsedName.data, code } });
    revalidatePath("/modulos/colaboradores");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao criar centro de custo." };
  }
}

export async function createManager(name: string, area: string, reportsToId?: string): Promise<ActionResult> {
  try {
    await requireHrAccess();
    const parsed = nameSchema.safeParse(name);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
    await prisma.manager.create({ data: { name: parsed.data, area: area || "—", reportsToId: reportsToId || null } });
    revalidatePath("/modulos/colaboradores");
    revalidatePath("/modulos/organograma");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao criar gestor." };
  }
}

export async function updateManagerHierarchy(managerId: string, reportsToId: string | null): Promise<ActionResult> {
  try {
    await requireHrAccess();
    if (reportsToId === managerId) {
      return { success: false, error: "Um gestor não pode reportar para si mesmo." };
    }
    await prisma.manager.update({ where: { id: managerId }, data: { reportsToId } });
    revalidatePath("/modulos/organograma");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao atualizar hierarquia." };
  }
}

export async function createUnit(name: string, city: string, state: string, type: "MATRIZ" | "FILIAL" = "FILIAL"): Promise<ActionResult> {
  try {
    await requireHrAccess();
    const parsed = nameSchema.safeParse(name);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
    const company = await prisma.company.findFirst();
    if (!company) return { success: false, error: "Nenhuma empresa cadastrada ainda." };
    await prisma.unit.create({ data: { name: parsed.data, city: city || "—", state: state || "—", type, companyId: company.id } });
    revalidatePath("/modulos/colaboradores");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao criar unidade." };
  }
}

export async function deletePosition(positionId: string): Promise<ActionResult> {
  try {
    await requireHrAccess();
    const inUse = await prisma.employee.count({ where: { positionId } });
    if (inUse > 0) {
      return { success: false, error: `Não é possível excluir: ${inUse} colaborador(es) usam este cargo.` };
    }
    await prisma.salaryBenchmark.deleteMany({ where: { positionId } });
    await prisma.position.delete({ where: { id: positionId } });
    revalidatePath("/modulos/custos");
    revalidatePath("/modulos/colaboradores");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao excluir cargo." };
  }
}

/**
 * Exclui um gestor (ex.: registro fictício de exemplo). Antes de apagar,
 * "religa" quem dependia dele: colaboradores que reportavam a ele ficam
 * sem gestor direto, e outros gestores que reportavam a ele passam a
 * reportar para o superior dele (a hierarquia não quebra).
 */
export async function deleteManager(managerId: string): Promise<ActionResult> {
  try {
    await requireHrAccess();
    const manager = await prisma.manager.findUnique({ where: { id: managerId }, select: { reportsToId: true } });
    if (!manager) return { success: false, error: "Gestor não encontrado." };

    await prisma.$transaction([
      prisma.manager.updateMany({ where: { reportsToId: managerId }, data: { reportsToId: manager.reportsToId } }),
      prisma.employee.updateMany({ where: { managerId }, data: { managerId: null } }),
      prisma.user.updateMany({ where: { managerOfId: managerId }, data: { managerOfId: null } }),
      prisma.manager.delete({ where: { id: managerId } }),
    ]);

    revalidatePath("/modulos/organograma");
    revalidatePath("/modulos/lideranca");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao excluir gestor." };
  }
}
