"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseLikertValue } from "@/lib/validation/survey-import";

const ALLOWED_ROLES = ["ADMINISTRADOR", "RH"];

async function requireHrAccess() {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    throw new Error("Você não tem permissão para importar pesquisas de clima.");
  }
}

export interface SurveyImportConfig {
  cycleName: string;
  totalInvited: number;
  areaColumn: string | null;
  statusColumn: string | null;
  npsColumn: string | null;
  likertColumns: string[];
}

export interface SurveyImportSummary {
  responsesCreated: number;
  respondentsCounted: number;
}

export async function importSurveyCycle(
  config: SurveyImportConfig,
  rows: Record<string, string>[]
): Promise<{ success: boolean; summary?: SurveyImportSummary; error?: string }> {
  try {
    await requireHrAccess();

    const cycleName = config.cycleName.trim();
    if (!cycleName) return { success: false, error: "Informe o nome do ciclo." };
    if (config.likertColumns.length === 0 && !config.npsColumn) {
      return { success: false, error: "Nenhuma pergunta reconhecida para importar." };
    }

    const existing = await prisma.climateSurveyResponse.count({ where: { cycle: cycleName } });
    if (existing > 0) {
      return { success: false, error: `Já existe um ciclo chamado "${cycleName}". Escolha outro nome.` };
    }

    const completedRows = config.statusColumn
      ? rows.filter((r) => (r[config.statusColumn!] ?? "").trim().toLowerCase() === "concluído" || (r[config.statusColumn!] ?? "").trim().toLowerCase() === "concluido")
      : rows;

    const toInsert: { cycle: string; dimension: string; question: string; score: number; area: string | null }[] = [];

    for (const row of completedRows) {
      const area = config.areaColumn ? (row[config.areaColumn] ?? "").trim() || null : null;

      for (const col of config.likertColumns) {
        const parsed = parseLikertValue(row[col] ?? "");
        if (!parsed) continue;
        toInsert.push({ cycle: cycleName, dimension: col, question: col, score: parsed.score10, area });
      }

      if (config.npsColumn) {
        const parsed = parseLikertValue(row[config.npsColumn] ?? "");
        if (parsed) {
          toInsert.push({
            cycle: cycleName,
            dimension: "Recomendaria a Empresa (eNPS)",
            question: config.npsColumn,
            score: parsed.score10,
            area,
          });
        }
      }
    }

    if (toInsert.length === 0) {
      return { success: false, error: "Nenhuma resposta válida encontrada no arquivo." };
    }

    await prisma.$transaction([
      prisma.climateSurveyResponse.createMany({ data: toInsert }),
      prisma.surveyCycleMeta.upsert({
        where: { cycle: cycleName },
        create: { cycle: cycleName, totalInvited: config.totalInvited, totalRespondents: completedRows.length },
        update: { totalInvited: config.totalInvited, totalRespondents: completedRows.length },
      }),
    ]);

    revalidatePath("/modulos/clima");
    return { success: true, summary: { responsesCreated: toInsert.length, respondentsCounted: completedRows.length } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao importar o ciclo." };
  }
}

export async function getExistingCycles() {
  const rows = await prisma.climateSurveyResponse.findMany({ select: { cycle: true }, distinct: ["cycle"] });
  return rows.map((r) => r.cycle);
}
