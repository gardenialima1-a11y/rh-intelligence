"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildHeaderMap, getField, parseCurrency, REGISTRATION_HEADERS, NAME_HEADERS } from "@/lib/validation/payroll-import";
import { EXTRA_BENEFIT_CATEGORIES } from "@/lib/validation/extra-benefits-import";

const ALLOWED_ROLES = ["ADMINISTRADOR", "RH"];

async function requireHrAccess() {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    throw new Error("Você não tem permissão para importar benefícios.");
  }
}

function normalizeName(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
}

export interface ExtraBenefitImportSummary {
  created: number;
  updated: number;
  totalAmount: number;
  categoriesFound: string[];
  unmatchedNames: string[];
}

/**
 * Importa a planilha de benefícios extra-folha para o mês escolhido. Cada
 * coluna reconhecida (ver EXTRA_BENEFIT_CATEGORIES) vira um lançamento por
 * colaborador; reimportar o mesmo mês atualiza os valores (upsert por
 * colaborador + mês + categoria), sem duplicar.
 */
export async function importExtraBenefits(
  rows: Record<string, string>[],
  competenceKey: string // "YYYY-MM"
): Promise<{ success: boolean; summary?: ExtraBenefitImportSummary; error?: string }> {
  try {
    await requireHrAccess();
    if (rows.length === 0) return { success: false, error: "Nenhuma linha encontrada no arquivo." };

    const match = competenceKey.match(/^(\d{4})-(\d{2})$/);
    if (!match) return { success: false, error: "Mês de competência inválido." };
    const [, yStr, mStr] = match;
    const competence = new Date(Number(yStr), Number(mStr) - 1, 1);

    const employees = await prisma.employee.findMany({ select: { id: true, registration: true, name: true } });
    const byRegistration = new Map(employees.map((e) => [e.registration.trim(), e]));
    const byName = new Map(employees.map((e) => [normalizeName(e.name), e]));

    const summary: ExtraBenefitImportSummary = {
      created: 0,
      updated: 0,
      totalAmount: 0,
      categoriesFound: [],
      unmatchedNames: [],
    };
    const categoriesFoundSet = new Set<string>();

    for (const row of rows) {
      const headerMap = buildHeaderMap(row);
      const registration = getField(row, headerMap, REGISTRATION_HEADERS).replace(/\.0$/, "");
      const name = getField(row, headerMap, NAME_HEADERS);

      const employee = (registration && byRegistration.get(registration)) || (name && byName.get(normalizeName(name)));
      if (!employee) {
        if (name) summary.unmatchedNames.push(name);
        continue;
      }

      for (const cat of EXTRA_BENEFIT_CATEGORIES) {
        const raw = getField(row, headerMap, cat.headers);
        if (!raw) continue;
        const valor = parseCurrency(raw);
        if (valor === null || valor <= 0) continue;

        categoriesFoundSet.add(cat.categoria);

        const existing = await prisma.extraBenefit.findUnique({
          where: { employeeId_competence_categoria: { employeeId: employee.id, competence, categoria: cat.categoria } },
          select: { id: true },
        });

        await prisma.extraBenefit.upsert({
          where: { employeeId_competence_categoria: { employeeId: employee.id, competence, categoria: cat.categoria } },
          create: { employeeId: employee.id, competence, categoria: cat.categoria, valor },
          update: { valor },
        });

        if (existing) summary.updated += 1;
        else summary.created += 1;
        summary.totalAmount += valor;
      }
    }

    summary.totalAmount = Math.round(summary.totalAmount * 100) / 100;
    summary.categoriesFound = Array.from(categoriesFoundSet);

    revalidatePath("/modulos/custos");
    revalidatePath("/modulos/beneficios");
    revalidatePath("/");
    return { success: true, summary };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao importar benefícios." };
  }
}
