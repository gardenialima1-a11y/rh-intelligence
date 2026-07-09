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

export async function createUnit(name: string, city: string, state: string): Promise<ActionResult> {
  try {
    await requireHrAccess();
    const parsed = nameSchema.safeParse(name);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
    const company = await prisma.company.findFirst();
    if (!company) return { success: false, error: "Nenhuma empresa cadastrada ainda." };
    await prisma.unit.create({ data: { name: parsed.data, city: city || "—", state: state || "—", companyId: company.id } });
    revalidatePath("/modulos/colaboradores");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao criar unidade." };
  }
}
