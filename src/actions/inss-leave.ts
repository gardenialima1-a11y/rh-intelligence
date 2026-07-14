"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { inssLeaveFormSchema } from "@/lib/validation/inss-leave";
import type { ActionResult } from "@/actions/employees";

const ALLOWED_ROLES = ["ADMINISTRADOR", "RH"];

async function requireHrAccess() {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    throw new Error("Você não tem permissão para gerenciar afastamentos.");
  }
}

export async function createInssLeave(raw: unknown): Promise<ActionResult> {
  try {
    await requireHrAccess();
    const parsed = inssLeaveFormSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    const data = parsed.data;

    await prisma.inssLeave.create({
      data: {
        employeeId: data.employeeId,
        cid: data.cid,
        startDate: new Date(data.startDate),
        expectedReturnDate: data.expectedReturnDate ? new Date(data.expectedReturnDate) : null,
        actualReturnDate: data.actualReturnDate ? new Date(data.actualReturnDate) : null,
        notes: data.notes || null,
      },
    });

    revalidatePath("/modulos/afastamentos-inss");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao criar afastamento." };
  }
}

export async function updateInssLeave(leaveId: string, raw: unknown): Promise<ActionResult> {
  try {
    await requireHrAccess();
    const parsed = inssLeaveFormSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    const data = parsed.data;

    await prisma.inssLeave.update({
      where: { id: leaveId },
      data: {
        employeeId: data.employeeId,
        cid: data.cid,
        startDate: new Date(data.startDate),
        expectedReturnDate: data.expectedReturnDate ? new Date(data.expectedReturnDate) : null,
        actualReturnDate: data.actualReturnDate ? new Date(data.actualReturnDate) : null,
        notes: data.notes || null,
      },
    });

    revalidatePath("/modulos/afastamentos-inss");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao atualizar afastamento." };
  }
}

export async function deleteInssLeave(leaveId: string): Promise<ActionResult> {
  try {
    await requireHrAccess();
    await prisma.inssLeave.delete({ where: { id: leaveId } });
    revalidatePath("/modulos/afastamentos-inss");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao excluir afastamento." };
  }
}

export async function getInssLeaves() {
  return prisma.inssLeave.findMany({
    include: { employee: { select: { id: true, name: true, registration: true } } },
    orderBy: [{ actualReturnDate: "asc" }, { startDate: "desc" }],
  });
}
