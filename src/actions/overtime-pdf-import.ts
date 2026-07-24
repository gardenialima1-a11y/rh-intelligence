"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePayrollPdf, type PayrollOvertimeRow } from "@/lib/pdf/payroll-parser";
import {
  confirmPdfImportSchema,
  OVERTIME_HOURLY_RATE_MIN,
  OVERTIME_HOURLY_RATE_MAX,
} from "@/lib/validation/overtime-pdf-import";
import { parseDateInputLocal } from "@/lib/validation/overtime-manual";

const ALLOWED_ROLES = ["ADMINISTRADOR", "RH"];
const DEFAULT_SCHEDULED_HOURS = 8;

async function requireHrAccess() {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    throw new Error("Você não tem permissão para gerenciar horas extras.");
  }
}

/** "28/02/2026" -> "2026-02-28" (pro campo de data do formulário de prévia). */
function toDateInputValue(dataFolhaBr: string | null): string {
  if (!dataFolhaBr) return "";
  const m = dataFolhaBr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return "";
  const [, d, mo, y] = m;
  return `${y}-${mo}-${d}`;
}

export interface PdfPreviewRow {
  matricula: string;
  nome: string;
  cpf: string | null;
  horasExtras: number;
  valorHE: number;
  custoPorHora: number | null;
  employeeId: string | null;
  matched: boolean;
  warning: boolean;
}

export interface PdfPreviewResult {
  success: boolean;
  error?: string;
  competencia?: string | null;
  dataFolha?: string | null;
  dateInputValue?: string;
  rows?: PdfPreviewRow[];
  unmatchedCount?: number;
  warningCount?: number;
}

/** Lê o PDF da folha (base64) e monta a prévia — sem gravar nada no banco ainda. */
export async function extractOvertimePdf(base64Pdf: string): Promise<PdfPreviewResult> {
  try {
    await requireHrAccess();

    const buffer = Buffer.from(base64Pdf, "base64");
    const parsed = await parsePayrollPdf(new Uint8Array(buffer));

    if (parsed.rows.length === 0) {
      return {
        success: false,
        error:
          "Não encontrei lançamentos de hora extra (verbas 150/200/357) nesse PDF. Confira se é o relatório de folha certo.",
      };
    }

    const matriculas = parsed.rows.map((r: PayrollOvertimeRow) => r.matricula);
    const employees = await prisma.employee.findMany({
      where: { registration: { in: matriculas } },
      select: { id: true, registration: true },
    });
    const byRegistration = new Map(employees.map((e) => [e.registration.trim(), e.id]));

    let unmatchedCount = 0;
    let warningCount = 0;

    const rows: PdfPreviewRow[] = parsed.rows.map((r) => {
      const employeeId = byRegistration.get(r.matricula.trim()) ?? null;
      const custoPorHora = r.horasExtras > 0 ? Math.round((r.valorHE / r.horasExtras) * 100) / 100 : null;
      const warning =
        custoPorHora != null && (custoPorHora < OVERTIME_HOURLY_RATE_MIN || custoPorHora > OVERTIME_HOURLY_RATE_MAX);
      if (!employeeId) unmatchedCount += 1;
      if (warning) warningCount += 1;
      return {
        matricula: r.matricula,
        nome: r.nome,
        cpf: r.cpf,
        horasExtras: r.horasExtras,
        valorHE: r.valorHE,
        custoPorHora,
        employeeId,
        matched: employeeId != null,
        warning,
      };
    });

    return {
      success: true,
      competencia: parsed.competencia,
      dataFolha: parsed.dataFolha,
      dateInputValue: toDateInputValue(parsed.dataFolha),
      rows,
      unmatchedCount,
      warningCount,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao ler o PDF da folha." };
  }
}

export interface ConfirmPdfImportResult {
  success: boolean;
  error?: string;
  importedCount?: number;
}

/** Grava no banco os lançamentos que a Gardenia confirmou na prévia. */
export async function confirmOvertimePdfImport(raw: unknown): Promise<ConfirmPdfImportResult> {
  try {
    await requireHrAccess();
    const parsed = confirmPdfImportSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

    let importedCount = 0;

    for (const row of parsed.data.rows) {
      const date = parseDateInputLocal(row.date);
      if (!date) continue;

      const horasExtras = Number(row.horasExtras);
      const valorHE = Number(row.valorHE);
      if (Number.isNaN(horasExtras) || Number.isNaN(valorHE) || horasExtras <= 0) continue;

      const scheduledHours = DEFAULT_SCHEDULED_HOURS;
      const workedHours = scheduledHours + horasExtras;

      await prisma.timeEntry.upsert({
        where: { date_employeeId: { date, employeeId: row.employeeId } },
        create: {
          date,
          employeeId: row.employeeId,
          scheduledHours,
          workedHours,
          overtimeHours: horasExtras,
          overtimeCost: valorHE,
          bankHoursDelta: 0,
        },
        update: {
          scheduledHours,
          workedHours,
          overtimeHours: horasExtras,
          overtimeCost: valorHE,
        },
      });
      importedCount += 1;
    }

    revalidatePath("/modulos/jornada");
    return { success: true, importedCount };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao importar os lançamentos." };
  }
}
