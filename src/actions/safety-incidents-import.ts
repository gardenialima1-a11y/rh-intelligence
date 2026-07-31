"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_ROLES = ["ADMINISTRADOR", "RH"];

async function requireHrAccess() {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    throw new Error("Você não tem permissão para importar ocorrências de segurança.");
  }
}

function normalizeName(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
}

/** Aceita várias formas de escrever o tipo na planilha e resolve pro valor interno certo. */
function normalizeIncidentType(raw: string): "ACIDENTE" | "NEAR_MISS" | "INCIDENTE_DESVIO" {
  const t = normalizeName(raw);
  if (t.includes("QUASE") || t.includes("NEAR")) return "NEAR_MISS";
  if (t.includes("DESVIO") || t.includes("INCIDENTE")) return "INCIDENTE_DESVIO";
  return "ACIDENTE";
}

export interface SafetyIncidentUnmatchedPreviewResult {
  success: boolean;
  error?: string;
  unmatchedNames?: string[];
  employees?: { id: string; name: string }[];
}

/**
 * Confere os nomes da planilha contra o cadastro (só por nome). O
 * colaborador é opcional aqui (dá pra registrar uma ocorrência sem vincular
 * a ninguém específico), então nomes em branco não entram na conferência.
 */
export async function previewUnmatchedSafetyIncidentNames(names: string[]): Promise<SafetyIncidentUnmatchedPreviewResult> {
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

export interface SafetyIncidentImportRow {
  data: string; // "YYYY-MM-DD"
  nome: string; // pode vir vazio (ocorrência sem colaborador identificado)
  tipo: string; // texto livre, normalizado na hora de importar
  cat: string; // "sim"/"não"/vazio
  diasAfastado: number;
  dataRetorno: string; // "YYYY-MM-DD" ou vazio
  descricao: string;
}

export interface SafetyIncidentsImportSummary {
  linhasProcessadas: number;
  criadas: number;
  porTipo: Record<string, number>;
  nomesIgnorados: string[];
}

export async function importSafetyIncidents(
  rows: SafetyIncidentImportRow[],
  nameOverrides: Record<string, string> = {}
): Promise<{ success: boolean; summary?: SafetyIncidentsImportSummary; error?: string }> {
  try {
    await requireHrAccess();
    if (rows.length === 0) return { success: false, error: "Nenhuma linha encontrada no arquivo." };

    const employees = await prisma.employee.findMany({ select: { id: true, name: true } });
    const byName = new Map(employees.map((e) => [normalizeName(e.name), e]));
    const employeesById = new Map(employees.map((e) => [e.id, e]));

    const summary: SafetyIncidentsImportSummary = {
      linhasProcessadas: 0,
      criadas: 0,
      porTipo: { ACIDENTE: 0, NEAR_MISS: 0, INCIDENTE_DESVIO: 0 },
      nomesIgnorados: [],
    };

    const toCreate: {
      employeeId: string | null;
      date: Date;
      type: "ACIDENTE" | "NEAR_MISS" | "INCIDENTE_DESVIO";
      hasCAT: boolean;
      daysLost: number;
      returnDate: Date | null;
      description: string | null;
    }[] = [];

    for (const row of rows) {
      const date = new Date(row.data + "T00:00:00");
      if (Number.isNaN(date.getTime())) continue;

      const nomeRaw = row.nome.trim();
      let employeeId: string | null = null;
      if (nomeRaw) {
        const employee =
          byName.get(normalizeName(nomeRaw)) ?? (nameOverrides[nomeRaw] ? employeesById.get(nameOverrides[nomeRaw]) : undefined);
        if (!employee) {
          summary.nomesIgnorados.push(nomeRaw);
          continue;
        }
        employeeId = employee.id;
      }

      const type = normalizeIncidentType(row.tipo);
      const hasCAT = /^(s|sim|yes|x)/i.test(row.cat.trim());
      const returnDate = row.dataRetorno.trim() ? new Date(row.dataRetorno + "T00:00:00") : null;

      toCreate.push({
        employeeId,
        date,
        type,
        hasCAT,
        daysLost: Math.max(0, Math.round(row.diasAfastado) || 0),
        returnDate: returnDate && !Number.isNaN(returnDate.getTime()) ? returnDate : null,
        description: row.descricao.trim() || null,
      });
      summary.linhasProcessadas += 1;
      summary.porTipo[type] += 1;
    }

    if (toCreate.length > 0) {
      const CHUNK = 25;
      for (let i = 0; i < toCreate.length; i += CHUNK) {
        const chunk = toCreate.slice(i, i + CHUNK);
        await Promise.all(
          chunk.map((entry) =>
            prisma.safetyIncident.create({
              data: {
                employeeId: entry.employeeId,
                date: entry.date,
                type: entry.type,
                hasCAT: entry.hasCAT,
                daysLost: entry.daysLost,
                returnDate: entry.returnDate,
                description: entry.description,
              },
            })
          )
        );
        summary.criadas += chunk.length;
      }
    }

    revalidatePath("/modulos/sst");
    return { success: true, summary };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao importar as ocorrências." };
  }
}
