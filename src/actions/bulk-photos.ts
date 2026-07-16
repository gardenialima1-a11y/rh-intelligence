"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_ROLES = ["ADMINISTRADOR", "RH"];

async function requireHrAccess() {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    throw new Error("Você não tem permissão para atualizar fotos em lote.");
  }
}

export interface PhotoUpdateItem {
  employeeId: string;
  photoUrl: string;
}

export interface BulkPhotoSummary {
  updated: number;
  failed: { employeeId: string; reason: string }[];
}

export async function bulkUpdatePhotos(
  items: PhotoUpdateItem[]
): Promise<{ success: boolean; summary?: BulkPhotoSummary; error?: string }> {
  try {
    await requireHrAccess();
    if (items.length === 0) return { success: false, error: "Nenhuma foto para salvar." };

    const summary: BulkPhotoSummary = { updated: 0, failed: [] };

    for (const item of items) {
      if (item.photoUrl.length >= 900_000) {
        summary.failed.push({ employeeId: item.employeeId, reason: "Imagem muito grande mesmo depois de redimensionar." });
        continue;
      }
      try {
        await prisma.employee.update({ where: { id: item.employeeId }, data: { photoUrl: item.photoUrl } });
        summary.updated += 1;
      } catch (err) {
        summary.failed.push({ employeeId: item.employeeId, reason: err instanceof Error ? err.message : "Erro desconhecido" });
      }
    }

    revalidatePath("/modulos/colaboradores");
    return { success: true, summary };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao salvar fotos." };
  }
}

export async function getEmployeesForPhotoMatch() {
  await requireHrAccess();
  return prisma.employee.findMany({
    where: { isActive: true },
    select: { id: true, registration: true, name: true },
    orderBy: { name: "asc" },
  });
}
