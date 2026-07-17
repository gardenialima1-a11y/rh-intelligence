"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildHeaderMap,
  getField,
  parseHours,
  parseCurrency,
  parseFolhaDate,
  REGISTRATION_HEADERS,
  NAME_HEADERS,
  DATE_HEADERS,
  SCHEDULED_HEADERS,
  WORKED_HEADERS,
  OVERTIME_HEADERS,
  OVERTIME_50_HEADERS,
  OVERTIME_100_HEADERS,
  OVERTIME_VALUE_HEADERS,
} from "@/lib/validation/overtime-import";

const ALLOWED_ROLES = ["ADMINISTRADOR", "RH"];
const DEFAULT_MONTHLY_HOURS = 220;
const DEFAULT_OVERTIME_MULTIPLIER = 1.5;

async function requireHrAccess() {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    throw new Error("Você não tem permissão para importar a folha de horas extras.");
  }
}

function normalizeName(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
}

export interface OvertimeImportSummary {
  created: number;
  totalOvertimeHours: number;
  totalOvertimeCost: number;
  estimatedCostCount: number;
  skippedNoOvertime: number;
  unmatchedNames: string[];
  invalidDates: number;
}

export async function importOvertimeReport(
  rows: Record<string, string>[]
): Promise<{ success: boolean; summary?: OvertimeImportSummary; error?: string }> {
  try {
    await requireHrAccess();
    if (rows.length === 0) return { success: false, error: "Nenhuma linha encontrada no arquivo." };

    const employees = await prisma.employee.findMany({
      select: { id: true, registration: true, name: true },
    });
    const byRegistration = new Map(employees.map((e) => [e.registration.trim(), e]));
    const byName = new Map(employees.map((e) => [normalizeName(e.name), e]));

    // Cache de folha de pagamento por competência (mês/ano), usado só para
    // estimar o custo da HE quando a planilha importada não traz valor.
    const payrollCache = new Map<string, number | null>();
    async function baseSalaryFor(employeeId: string, date: Date): Promise<number | null> {
      const competence = new Date(date.getFullYear(), date.getMonth(), 1);
      const cacheKey = `${employeeId}:${competence.getTime()}`;
      if (payrollCache.has(cacheKey)) return payrollCache.get(cacheKey)!;
      const entry = await prisma.payrollEntry.findUnique({
        where: { employeeId_competence: { employeeId, competence } },
        select: { baseSalary: true },
      });
      const value = entry?.baseSalary ?? null;
      payrollCache.set(cacheKey, value);
      return value;
    }

    const summary: OvertimeImportSummary = {
      created: 0,
      totalOvertimeHours: 0,
      totalOvertimeCost: 0,
      estimatedCostCount: 0,
      skippedNoOvertime: 0,
      unmatchedNames: [],
      invalidDates: 0,
    };

    for (const row of rows) {
      const headerMap = buildHeaderMap(row);
      const registration = getField(row, headerMap, REGISTRATION_HEADERS).replace(/\.0$/, "");
      const name = getField(row, headerMap, NAME_HEADERS);
      const dateRaw = getField(row, headerMap, DATE_HEADERS);

      const date = parseFolhaDate(dateRaw);
      if (!date) {
        if (dateRaw) summary.invalidDates += 1;
        continue;
      }

      const employee = (registration && byRegistration.get(registration)) || (name && byName.get(normalizeName(name)));
      if (!employee) {
        if (name) summary.unmatchedNames.push(name);
        continue;
      }

      const scheduledHours = parseHours(getField(row, headerMap, SCHEDULED_HEADERS)) ?? 0;
      const workedHours = parseHours(getField(row, headerMap, WORKED_HEADERS)) ?? 0;

      // Horas extras: usa a coluna direta se existir; senão soma HE 50% + HE
      // 100% se existirem; senão calcula pela diferença trabalhado - previsto.
      let overtimeHours = parseHours(getField(row, headerMap, OVERTIME_HEADERS));
      if (overtimeHours === null) {
        const he50 = parseHours(getField(row, headerMap, OVERTIME_50_HEADERS)) ?? 0;
        const he100 = parseHours(getField(row, headerMap, OVERTIME_100_HEADERS)) ?? 0;
        if (he50 || he100) {
          overtimeHours = he50 + he100;
        } else if (scheduledHours && workedHours) {
          overtimeHours = Math.max(0, workedHours - scheduledHours);
        }
      }

      if (!overtimeHours || overtimeHours <= 0) {
        summary.skippedNoOvertime += 1;
        continue;
      }

      let overtimeCost = parseCurrency(getField(row, headerMap, OVERTIME_VALUE_HEADERS));
      if (overtimeCost === null) {
        const baseSalary = await baseSalaryFor(employee.id, date);
        if (baseSalary) {
          const hourlyRate = baseSalary / DEFAULT_MONTHLY_HOURS;
          overtimeCost = Math.round(hourlyRate * DEFAULT_OVERTIME_MULTIPLIER * overtimeHours * 100) / 100;
          summary.estimatedCostCount += 1;
        } else {
          overtimeCost = 0;
        }
      }

      const bankHoursDelta = 0;

      await prisma.timeEntry.upsert({
        where: { date_employeeId: { date, employeeId: employee.id } },
        create: {
          date,
          employeeId: employee.id,
          scheduledHours,
          workedHours: workedHours || scheduledHours + overtimeHours,
          overtimeHours,
          overtimeCost,
          bankHoursDelta,
        },
        update: {
          ...(scheduledHours ? { scheduledHours } : {}),
          ...(workedHours ? { workedHours } : {}),
          overtimeHours,
          overtimeCost,
        },
      });

      summary.created += 1;
      summary.totalOvertimeHours += overtimeHours;
      summary.totalOvertimeCost += overtimeCost;
    }

    summary.totalOvertimeHours = Math.round(summary.totalOvertimeHours * 10) / 10;
    summary.totalOvertimeCost = Math.round(summary.totalOvertimeCost * 100) / 100;

    revalidatePath("/modulos/jornada");
    return { success: true, summary };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao importar a folha de horas extras." };
  }
}
