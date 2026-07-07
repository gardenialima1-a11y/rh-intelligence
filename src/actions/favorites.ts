"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function toggleFavorite(moduleKey: string, currentPath: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Não autenticado.");

  const existing = await prisma.favorite.findUnique({
    where: { userId_moduleKey: { userId: session.user.id, moduleKey } },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
  } else {
    await prisma.favorite.create({ data: { userId: session.user.id, moduleKey } });
  }

  revalidatePath(currentPath);
  revalidatePath("/", "layout"); // atualiza a lista de favoritos na sidebar em toda a plataforma
}

export async function isModuleFavorite(moduleKey: string): Promise<boolean> {
  const session = await auth();
  if (!session?.user) return false;

  const existing = await prisma.favorite.findUnique({
    where: { userId_moduleKey: { userId: session.user.id, moduleKey } },
  });
  return !!existing;
}

export async function getFavoriteModuleKeys(): Promise<string[]> {
  const session = await auth();
  if (!session?.user) return [];

  const favorites = await prisma.favorite.findMany({
    where: { userId: session.user.id },
    select: { moduleKey: true },
  });
  return favorites.map((f) => f.moduleKey);
}
