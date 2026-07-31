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
 *
 * Busca tudo que precisa (jornadas e ausências já existentes) em blocos
 * únicos ANTES de escrever, em vez de uma consulta por dia — com centenas de
 * dias numa planilha grande, ida-e-volta ao banco um por um demorava
 * minutos e travava a tela. Escreve em paralelo (em lotes) por segurança.
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

    const summary: AtestadosImportSummary = {
      linhasProcessadas: 0,
      ausenciasCriadas: 0,
      ausenciasAtualizadas: 0,
      diasSemJornadaCadastrada: 0,
      nomesIgnorados: [],
    };

    // 1) Monta a lista completa de dias a processar (um dia por linha da
    // planilha × quantidade de dias do afastamento), já resolvendo o
    // colaborador de cada um.
    interface Entry {
      employeeId: string;
      date: Date;
      dateKey: string;
      doenca: string;
      cid: string | null;
    }
    const entries: Entry[] = [];

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
      const cid = row.cid.trim() && row.cid.trim().toUpperCase() !== "S/C" ? row.cid.trim() : null;

      summary.linhasProcessadas += 1;

      for (let i = 0; i < dias; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        entries.push({
          employeeId: employee.id,
          date,
          dateKey: date.toISOString().slice(0, 10),
          doenca: row.doenca,
          cid,
        });
      }
    }

    if (entries.length === 0) {
      return { success: true, summary };
    }

    // 2) Garante os Reason (motivo = doença) de uma vez, um upsert por
    // doença ÚNICA (não por linha) — normalmente são poucas dezenas.
    const uniqueDiseases = Array.from(new Set(entries.map((e) => e.doenca.trim() || "Doença não informada")));
    const reasonCache = new Map<string, string>();
    await Promise.all(
      uniqueDiseases.map(async (label) => {
        const reason = await prisma.reason.upsert({
          where: { category_label: { category: "AFASTAMENTO", label } },
          create: { category: "AFASTAMENTO", label },
          update: {},
        });
        reasonCache.set(label, reason.id);
      })
    );

    // 3) Busca de uma vez só a jornada (TimeEntry) e as ausências já
    // existentes pra TODOS os colaboradores/dias envolvidos.
    const employeeIds = Array.from(new Set(entries.map((e) => e.employeeId)));
    const entryDates = entries.map((e) => e.date.getTime());
    const minDate = new Date(Math.min(...entryDates));
    const maxDate = new Date(Math.max(...entryDates));

    const [timeEntries, existingAbsences] = await Promise.all([
      prisma.timeEntry.findMany({
        where: { employeeId: { in: employeeIds }, date: { gte: minDate, lte: maxDate } },
        select: { employeeId: true, date: true, scheduledHours: true },
      }),
      prisma.absence.findMany({
        where: { employeeId: { in: employeeIds }, date: { gte: minDate, lte: maxDate } },
        select: { id: true, employeeId: true, date: true },
      }),
    ]);

    const scheduledByKey = new Map(
      timeEntries.map((t) => [`${t.employeeId}_${t.date.toISOString().slice(0, 10)}`, t.scheduledHours])
    );
    const absenceIdByKey = new Map(
      existingAbsences.map((a) => [`${a.employeeId}_${a.date.toISOString().slice(0, 10)}`, a.id])
    );

    // 4) Escreve tudo em paralelo, em lotes (pra não abrir milhares de
    // conexões simultâneas de uma vez só).
    const WRITE_CHUNK = 25;
    for (let i = 0; i < entries.length; i += WRITE_CHUNK) {
      const chunk = entries.slice(i, i + WRITE_CHUNK);
      const results = await Promise.all(
        chunk.map(async (entry) => {
          const key = `${entry.employeeId}_${entry.dateKey}`;
          const scheduledHours = scheduledByKey.get(key);
          if (!scheduledHours || scheduledHours <= 0) return "sem_jornada" as const;

          const reasonId = reasonCache.get(entry.doenca.trim() || "Doença não informada")!;
          const existingId = absenceIdByKey.get(key);

          const writes: Promise<unknown>[] = [
            existingId
              ? prisma.absence.update({
                  where: { id: existingId },
                  data: { reasonId, cid: entry.cid, hasCertificate: true, hoursLost: scheduledHours, absenceType: "UM_DIA_OU_MAIS" },
                })
              : prisma.absence.create({
                  data: {
                    employeeId: entry.employeeId,
                    date: entry.date,
                    reasonId,
                    cid: entry.cid,
                    hasCertificate: true,
                    hoursLost: scheduledHours,
                    absenceType: "UM_DIA_OU_MAIS",
                  },
                }),
            prisma.attendanceRecord.updateMany({
              where: { employeeId: entry.employeeId, date: entry.date },
              data: { status: "ATESTADO" },
            }),
          ];
          await Promise.all(writes);
          return existingId ? ("atualizada" as const) : ("criada" as const);
        })
      );

      for (const r of results) {
        if (r === "sem_jornada") summary.diasSemJornadaCadastrada += 1;
        else if (r === "criada") summary.ausenciasCriadas += 1;
        else summary.ausenciasAtualizadas += 1;
      }
    }

    revalidatePath("/modulos/sst");
    revalidatePath("/modulos/absenteismo");
    return { success: true, summary };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao importar os atestados." };
  }
}
