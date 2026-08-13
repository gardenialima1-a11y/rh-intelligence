"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildHeaderMap,
  getField,
  parseCurrency,
  REGISTRATION_HEADERS,
  NAME_HEADERS,
  BASE_SALARY_HEADERS,
  BENEFITS_HEADERS,
  CHARGES_HEADERS,
  TOTAL_COST_HEADERS,
} from "@/lib/validation/payroll-import";

const ALLOWED_ROLES = ["ADMINISTRADOR", "RH"];
// Usados só quando a planilha não traz as colunas de Benefícios/Encargos —
// mesmo percentual padrão já usado no cadastro manual de colaborador.
const DEFAULT_BENEFITS_RATE = 0.18;
const DEFAULT_CHARGES_RATE = 0.42;

async function requireHrAccess() {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    throw new Error("Você não tem permissão para importar a folha de pagamento.");
  }
}

function normalizeName(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
}

export interface PayrollImportSummary {
  created: number;
  updated: number;
  totalCost: number;
  estimatedCount: number;
  unmatchedNames: string[];
  invalidRows: number;
  /** Colaboradores já desligados no cadastro — não importados aqui (sem detalhamento pra calcular rescisão). Use o PDF da folha ou lance o custo de rescisão direto no desligamento. */
  inactiveSkipped: string[];
}

/**
 * Importa a planilha de folha para o mês (competência) escolhido. Faz
 * upsert por colaborador+competência: se já existir lançamento daquele
 * colaborador no mês, atualiza; senão, cria.
 */
export async function importPayrollReport(
  rows: Record<string, string>[],
  competenceKey: string // "YYYY-MM"
): Promise<{ success: boolean; summary?: PayrollImportSummary; error?: string }> {
  try {
    await requireHrAccess();
    if (rows.length === 0) return { success: false, error: "Nenhuma linha encontrada no arquivo." };

    const match = competenceKey.match(/^(\d{4})-(\d{2})$/);
    if (!match) return { success: false, error: "Mês de competência inválido." };
    const [, yStr, mStr] = match;
    const competence = new Date(Number(yStr), Number(mStr) - 1, 1);

    const employees = await prisma.employee.findMany({ select: { id: true, registration: true, name: true, isActive: true } });
    const byRegistration = new Map(employees.map((e) => [e.registration.trim(), e]));
    const byName = new Map(employees.map((e) => [normalizeName(e.name), e]));

    const summary: PayrollImportSummary = {
      created: 0,
      updated: 0,
      totalCost: 0,
      estimatedCount: 0,
      unmatchedNames: [],
      invalidRows: 0,
      inactiveSkipped: [],
    };

    for (const row of rows) {
      const headerMap = buildHeaderMap(row);
      const registration = getField(row, headerMap, REGISTRATION_HEADERS).replace(/\.0$/, "");
      const name = getField(row, headerMap, NAME_HEADERS);

      const employee = (registration && byRegistration.get(registration)) || (name && byName.get(normalizeName(name)));
      if (!employee) {
        if (name) summary.unmatchedNames.push(name);
        continue;
      }

      // Colaborador já desligado: essa planilha não tem o detalhamento (proventos linha a
      // linha) pra calcular o valor de rescisão, então não dá pra separar automaticamente
      // como no import de PDF — melhor pular e avisar, do que criar um custo de folha errado.
      if (!employee.isActive) {
        summary.inactiveSkipped.push(employee.name);
        continue;
      }

      const baseSalary = parseCurrency(getField(row, headerMap, BASE_SALARY_HEADERS));
      if (baseSalary === null || baseSalary <= 0) {
        summary.invalidRows += 1;
        continue;
      }

      let benefitsCost = parseCurrency(getField(row, headerMap, BENEFITS_HEADERS));
      let chargesCost = parseCurrency(getField(row, headerMap, CHARGES_HEADERS));
      let estimated = false;
      if (benefitsCost === null) {
        benefitsCost = Math.round(baseSalary * DEFAULT_BENEFITS_RATE * 100) / 100;
        estimated = true;
      }
      if (chargesCost === null) {
        chargesCost = Math.round(baseSalary * DEFAULT_CHARGES_RATE * 100) / 100;
        estimated = true;
      }
      if (estimated) summary.estimatedCount += 1;

      const totalCostFromSheet = parseCurrency(getField(row, headerMap, TOTAL_COST_HEADERS));
      const totalCost = totalCostFromSheet ?? baseSalary + benefitsCost + chargesCost;

      const existing = await prisma.payrollEntry.findUnique({
        where: { employeeId_competence: { employeeId: employee.id, competence } },
        select: { id: true },
      });

      await prisma.payrollEntry.upsert({
        where: { employeeId_competence: { employeeId: employee.id, competence } },
        create: { employeeId: employee.id, competence, baseSalary, benefitsCost, chargesCost, totalCost },
        update: { baseSalary, benefitsCost, chargesCost, totalCost },
      });

      if (existing) summary.updated += 1;
      else summary.created += 1;
      summary.totalCost += totalCost;
    }

    summary.totalCost = Math.round(summary.totalCost * 100) / 100;

    revalidatePath("/modulos/custos");
    revalidatePath("/modulos/beneficios");
    revalidatePath("/modulos/jornada");
    revalidatePath("/modulos/administracao");
    revalidatePath("/");
    return { success: true, summary };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao importar a folha de pagamento." };
  }
}
