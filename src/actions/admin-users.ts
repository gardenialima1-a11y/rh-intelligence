"use server";

import crypto from "crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMINISTRADOR") {
    throw new Error("Você não tem permissão para gerenciar administradores.");
  }
  return session.user;
}

export interface AdminAccount {
  id: string;
  name: string | null;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

// Lista apenas usuários com perfil ADMINISTRADOR — nenhuma senha ou hash
// é retornado aqui, somente os dados de identificação.
export async function listAdminAccounts(): Promise<AdminAccount[]> {
  await requireAdmin();
  return prisma.user.findMany({
    where: { role: "ADMINISTRADOR" },
    select: { id: true, name: true, email: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: "asc" },
  });
}

// Gera uma senha temporária aleatória e segura (14 caracteres,
// letras maiúsculas/minúsculas, números e símbolos).
function generateTemporaryPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = crypto.randomBytes(16);
  let password = "";
  for (let i = 0; i < 14; i++) {
    password += alphabet[bytes[i] % alphabet.length];
  }
  return password;
}

// Redefine a senha de um administrador. A nova senha é gerada pelo servidor,
// nunca digitada em um campo, e é devolvida UMA ÚNICA VEZ na resposta desta
// action — para ser mostrada apenas a quem está logado como administrador
// no momento da ação. Ela não fica salva em texto puro em nenhum lugar:
// somente o hash (bcrypt) é persistido no banco.
export async function resetAdminPassword(
  targetUserId: string
): Promise<{ success: boolean; temporaryPassword?: string; email?: string; error?: string }> {
  try {
    const actor = await requireAdmin();

    const target = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true, role: true },
    });

    if (!target || target.role !== "ADMINISTRADOR") {
      return { success: false, error: "Administrador não encontrado." };
    }

    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    await prisma.user.update({
      where: { id: target.id },
      data: { passwordHash },
    });

    await prisma.accessLog.create({
      data: {
        userId: actor.id as string,
        path: "/modulos/administracao",
        action: `Redefiniu a senha do administrador ${target.email}`,
      },
    });

    revalidatePath("/modulos/administracao");

    // Retornado apenas nesta resposta única, em memória no navegador de
    // quem executou a ação — nunca gravado em log, banco ou tela pública.
    return { success: true, temporaryPassword, email: target.email };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erro ao redefinir senha." };
  }
}
