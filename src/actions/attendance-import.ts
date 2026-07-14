"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { classifyAttendanceRow, type AttendanceStatus } from "@/lib/validation/attendance-import";

const ALLOWED_ROLES = ["ADMINISTRADOR", "RH"];

async function requireHrAccess() {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    throw new Error("Você não tem permissão para importar o relatório de ponto.");
  }
}

/** Aceita "14/07/26 Ter" ou "14/07/2026" e devolve um Date (meia-noite). */
function parseReportDate(raw: string): Date | null {
  const match = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!match) return null;
  const [, d, m, yRaw] = match;
  const y = yRaw.length === 2 ? 2000 + Number(yRaw) : Number(yRaw);
  const date = new Date(y, Number(m) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeName(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
}

export interface AttendanceImportSummary {
  created: number;
  faltas: number;
  ferias: number;
  cargoConfiancaDetectados: number;
  unmatchedNames: string[];
  outros: { nome: string; texto: string }[];
}

export async function importAttendanceReport(
  rows: Record<string, string>[]
): Promise<{ success: boolean; summary?: AttendanceImportSummary; error?: string }> {
  try {
    await requireHrAccess();
    if (rows.length === 0) return { success: false, error: "Nenhuma linha encontrada no arquivo." };

    const employees = await prisma.employee.findMany({
      select: { id: true, registration: true, name: true, isTrustPosition: true },
    });
    const byRegistration = new Map(employees.map((e) => [e.registration.trim(), e]));
    const byName = new Map(employees.map((e) => [normalizeName(e.name), e]));

    const summary: AttendanceImportSummary = {
      created: 0,
      faltas: 0,
      ferias: 0,
      cargoConfiancaDetectados: 0,
      unmatchedNames: [],
      outros: [],
    };
    const trustPositionIdsToSet = new Set<string>();

    for (const row of rows) {
      const codigoRaw = (row["Código"] ?? "").toString().trim().replace(/\.0$/, "");
      const nomeRaw = (row["Nome"] ?? "").toString().trim();
      const diaRaw = (row["Dia"] ?? "").toString();
      const rotina = (row["Rotina Esperada"] ?? "").toString().trim();
      const setorNoDia = (row["Local de Trabalho Cadastrado"] ?? "").toString().trim() || null;
      const hasEntrada = Boolean((row["Entrada"] ?? "").toString().trim());
      const atrasoRaw = (row["Atrasos"] ?? "").toString().trim();

      const date = parseReportDate(diaRaw);
      if (!date || !rotina) continue;

      const employee = byRegistration.get(codigoRaw) ?? byName.get(normalizeName(nomeRaw));
      if (!employee) {
        if (nomeRaw) summary.unmatchedNames.push(nomeRaw);
        continue;
      }

      let status: AttendanceStatus = classifyAttendanceRow({ rotinaEsperada: rotina, hasEntrada });

      if (status === "CARGO_CONFIANCA") {
        trustPositionIdsToSet.add(employee.id);
        summary.cargoConfiancaDetectados += 1;
      }
      // Quem já está marcado como Cargo de Confiança nunca conta falta, mesmo que o
      // relatório daquele dia específico não repita o aviso.
      if (employee.isTrustPosition) status = "CARGO_CONFIANCA";

      const atrasoMatch = atrasoRaw.match(/^(\d{1,2}):(\d{2})$/);
      const atrasoMinutos = atrasoMatch ? Number(atrasoMatch[1]) * 60 + Number(atrasoMatch[2]) : null;

      await prisma.attendanceRecord.upsert({
        where: { employeeId_date: { employeeId: employee.id, date } },
        create: { employeeId: employee.id, date, status, rawRotina: rotina, setorNoDia, atrasoMinutos },
        update: { status, rawRotina: rotina, setorNoDia, atrasoMinutos },
      });

      summary.created += 1;
      if (status === "FALTOU") summary.faltas += 1;
      if (status === "FERIAS") summary.ferias += 1;
      if (status === "OUTRO") summary.outros.push({ nome: employee.name, texto: rotina });
    }

    if (trustPositionIdsToSet.size > 0) {
      await prisma.employee.updateMany({
        where: { id: { in: Array.from(trustPositionIdsToSet) } },
        data: { isTrustPosition: true },
      });
    }

    revalidatePath("/modulos/absenteismo");
    return { success: true, summary };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao importar o relatório de ponto." };
  }
}
