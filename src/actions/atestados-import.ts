"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_ROLES = ["ADMINISTRADOR", "RH"];

async function requireHrAccess() {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    throw new Error("Você não tem permissão para importar atestados.");
  }
}

function normalizeName(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
}

export interface AtestadoUnmatchedPreviewResult {
  success: boolean;
  error?: string;
  unmatchedNames?: string[];
  employees?: { id: string; name: string }[];
}

/**
 * Confere os nomes da planilha contra o cadastro (só por nome — essa
 * planilha não tem matrícula) e devolve quem não bateu, pra você escolher
 * manualmente o colaborador certo antes de importar de verdade.
 */
export async function previewUnmatchedAtestadoNames(names: string[]): Promise<AtestadoUnmatchedPreviewResult> {
  try {
    await requireHrAccess();
    const employees = await prisma.employee.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
    const byName = new Set(employees.map((e) => normalizeName(e.name)));

    const unmatched = new Set<string>();
    for (const raw of names) {
      const nome = raw.trim();
      if (!nome) continue;
      if (!byName.has(normalizeName(nome))) unmatched.add(nome);
    }

    return {
      success: true,
      unmatchedNames: Array.from(unmatched).sort((a, b) => a.localeCompare(b, "pt-BR")),
      employees: employees.map((e) => ({ id: e.id, name: e.name })),
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao conferir os colaboradores." };
  }
}

export interface AtestadoImportRow {
  data: string; // "YYYY-MM-DD"
  nome: string;
  setor: string;
  cid: string;
  doenca: string;
  dias: number;
}

export interface AtestadosImportSummary {
  linhasProcessadas: number;
  ausenciasCriadas: number;
  ausenciasAtualizadas: number;
  /** Dias do afastamento que caíram num dia sem jornada registrada no ponto (fim de semana, ou ponto ainda não importado pra essa data) — esses dias são pulados, não entram no cálculo. */
  diasSemJornadaCadastrada: number;
  nomesIgnorados: string[];
}

/**
 * Importa atestados de verdade: pra cada linha (um atestado, com data de
 * início e quantidade de dias), cria/atualiza uma Absence PARA CADA DIA do
 * afastamento — mas só nos dias em que o colaborador já tem jornada
 * registrada no ponto (TimeEntry). Isso evita inflar a taxa de absenteísmo
 * com dias que nem contam como jornada esperada (fim de semana, por
 * exemplo), e mantém consistência com o que a importação de ponto já criou:
 * se aquele dia já estava marcado como "falta injustificada" por não ter
 * atestado detectado na hora, essa importação corrige pra "com atestado".
 */
export async function importAtestados(
  rows: AtestadoImportRow[],
  nameOverrides: Record<string, string> = {}
): Promise<{ success: boolean; summary?: AtestadosImportSummary; error?: string }> {
  try {
    await requireHrAccess();
    if (rows.length === 0) return { success: false, error: "Nenhuma linha encontrada no arquivo." };

    const employees = await prisma.employee.findMany({ select: { id: true, name: true } });
    const byName = new Map(employees.map((e) => [normalizeName(e.name), e]));
    const employeesById = new Map(employees.map((e) => [e.id, e]));

    const reasonCache = new Map<string, string>();
    async function ensureReason(label: string): Promise<string> {
      const clean = label.trim() || "Doença não informada";
      const cached = reasonCache.get(clean);
      if (cached) return cached;
      const reason = await prisma.reason.upsert({
        where: { category_label: { category: "AFASTAMENTO", label: clean } },
        create: { category: "AFASTAMENTO", label: clean },
        update: {},
      });
      reasonCache.set(clean, reason.id);
      return reason.id;
    }

    const summary: AtestadosImportSummary = {
      linhasProcessadas: 0,
      ausenciasCriadas: 0,
      ausenciasAtualizadas: 0,
      diasSemJornadaCadastrada: 0,
      nomesIgnorados: [],
    };

    for (const row of rows) {
      const nomeRaw = row.nome.trim();
      const employee =
        byName.get(normalizeName(nomeRaw)) ?? (nameOverrides[nomeRaw] ? employeesById.get(nameOverrides[nomeRaw]) : undefined);
      if (!employee) {
        if (nomeRaw) summary.nomesIgnorados.push(nomeRaw);
        continue;
      }

      const startDate = new Date(row.data + "T00:00:00");
      if (Number.isNaN(startDate.getTime())) continue;
      const dias = Math.max(1, Math.round(row.dias) || 1);
      const reasonId = await ensureReason(row.doenca);
      const cid = row.cid.trim() && row.cid.trim().toUpperCase() !== "S/C" ? row.cid.trim() : null;

      summary.linhasProcessadas += 1;

      for (let i = 0; i < dias; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);

        const timeEntry = await prisma.timeEntry.findUnique({
          where: { date_employeeId: { date, employeeId: employee.id } },
          select: { scheduledHours: true },
        });
        if (!timeEntry || timeEntry.scheduledHours <= 0) {
          summary.diasSemJornadaCadastrada += 1;
          continue;
        }

        const existing = await prisma.absence.findFirst({
          where: { employeeId: employee.id, date },
          select: { id: true },
        });

        if (existing) {
          await prisma.absence.update({
            where: { id: existing.id },
            data: { reasonId, cid, hasCertificate: true, hoursLost: timeEntry.scheduledHours, absenceType: "UM_DIA_OU_MAIS" },
          });
          summary.ausenciasAtualizadas += 1;
        } else {
          await prisma.absence.create({
            data: {
              employeeId: employee.id,
              date,
              reasonId,
              cid,
              hasCertificate: true,
              hoursLost: timeEntry.scheduledHours,
              absenceType: "UM_DIA_OU_MAIS",
            },
          });
          summary.ausenciasCriadas += 1;
        }

        await prisma.attendanceRecord.updateMany({
          where: { employeeId: employee.id, date },
          data: { status: "ATESTADO" },
        });
      }
    }

    revalidatePath("/modulos/sst");
    revalidatePath("/modulos/absenteismo");
    return { success: true, summary };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao importar os atestados." };
  }
}
