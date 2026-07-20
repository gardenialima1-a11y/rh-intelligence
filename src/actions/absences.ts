"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { absenceFormSchema, parseHoursLost } from "@/lib/validation/absence";
import type { ActionResult } from "@/actions/employees";

const ALLOWED_ROLES = ["ADMINISTRADOR", "RH"];

async function requireHrAccess() {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    throw new Error("Você não tem permissão para gerenciar atestados.");
  }
}

export async function createAbsence(raw: unknown): Promise<ActionResult> {
  try {
    await requireHrAccess();
    const parsed = absenceFormSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    const data = parsed.data;

    await prisma.absence.create({
      data: {
        employeeId: data.employeeId,
        date: new Date(data.date),
        reasonId: data.reasonId || null,
        cid: data.cid || null,
        hoursLost: parseHoursLost(data.hoursLost),
        hasCertificate: data.hasCertificate,
        absenceType: data.absenceType,
        returnDate: data.returnDate ? new Date(data.returnDate) : null,
        attachmentUrl: data.attachmentUrl || null,
        attachmentName: data.attachmentName || null,
      },
    });

    revalidatePath("/modulos/sst");
    revalidatePath("/modulos/absenteismo");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao criar atestado." };
  }
}

export async function updateAbsence(absenceId: string, raw: unknown): Promise<ActionResult> {
  try {
    await requireHrAccess();
    const parsed = absenceFormSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
    const data = parsed.data;

    await prisma.absence.update({
      where: { id: absenceId },
      data: {
        employeeId: data.employeeId,
        date: new Date(data.date),
        reasonId: data.reasonId || null,
        cid: data.cid || null,
        hoursLost: parseHoursLost(data.hoursLost),
        hasCertificate: data.hasCertificate,
        absenceType: data.absenceType,
        returnDate: data.returnDate ? new Date(data.returnDate) : null,
        attachmentUrl: data.attachmentUrl || null,
        attachmentName: data.attachmentName || null,
      },
    });

    revalidatePath("/modulos/sst");
    revalidatePath("/modulos/absenteismo");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao atualizar atestado." };
  }
}

export async function deleteAbsence(absenceId: string): Promise<ActionResult> {
  try {
    await requireHrAccess();
    await prisma.absence.delete({ where: { id: absenceId } });
    revalidatePath("/modulos/sst");
    revalidatePath("/modulos/absenteismo");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao excluir atestado." };
  }
}

export async function getCertificatedAbsences() {
  return prisma.absence.findMany({
    where: { hasCertificate: true },
    include: { employee: { select: { id: true, name: true } }, reason: true },
    orderBy: { date: "desc" },
    take: 200,
  });
}
