"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { classifyAttendanceRow, type AttendanceStatus } from "@/lib/validation/attendance-import";

const ALLOWED_ROLES = ["ADMINISTRADOR", "RH"];

/**
 * Abaixo de 15 minutos de diferença entre o esperado e o trabalhado, tratamos
 * como ruído de relógio/registro (ex.: bater ponto às 07:02 em vez de 07:00),
 * não como ausência de verdade. 15 min é a tolerância comum em políticas de
 * ponto no Brasil.
 */
const TOLERANCIA_MIN = 15;

async function requireHrAccess() {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    throw new Error("Você não tem permissão para importar o relatório de ponto.");
  }
}

export interface UnmatchedPreviewResult {
  success: boolean;
  error?: string;
  unmatchedNames?: string[];
  employees?: { id: string; name: string }[];
}

/**
 * Escaneia o arquivo (sem gravar nada) e devolve a lista de nomes que não bateram
 * com ninguém do cadastro — nem pela matrícula, nem pelo nome — pra Gardenia
 * confirmar manualmente antes da importação de verdade rodar.
 */
export async function previewUnmatchedNames(rows: Record<string, string>[]): Promise<UnmatchedPreviewResult> {
  try {
    await requireHrAccess();

    const employees = await prisma.employee.findMany({
      select: { id: true, registration: true, name: true },
      orderBy: { name: "asc" },
    });
    const byRegistration = new Set(employees.map((e) => e.registration.trim()));
    const byName = new Set(employees.map((e) => normalizeName(e.name)));

    const unmatched = new Set<string>();
    for (const row of rows) {
      const codigoRaw = (row["Código"] ?? "").toString().trim().replace(/\.0$/, "");
      const nomeRaw = (row["Nome"] ?? "").toString().trim();
      if (!nomeRaw) continue;
      const matched = byRegistration.has(codigoRaw) || byName.has(normalizeName(nomeRaw));
      if (!matched) unmatched.add(nomeRaw);
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

/** "07:30", "128:00" etc. -> minutos. Aceita até 3 dígitos de hora (o relatório soma o mês inteiro em algumas colunas). */
function toMinutes(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const match = raw.toString().trim().match(/^(\d{1,3}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

interface ParsedRow {
  codigoRaw: string;
  nomeRaw: string;
  date: Date;
  rotina: string;
  setorNoDia: string | null;
  hasEntrada: boolean;
  atrasoMinutos: number | null;
  saidaAntecipadaMinutos: number | null;
  obs: string;
  entradaEspMin: number | null;
  saidaEspMin: number | null;
  pausaEspMin: number | null;
  retornoEspMin: number | null;
  duracaoMin: number | null;
}

/** Jornada líquida esperada (minutos) a partir das colunas de horário esperado da linha, se existirem. */
function scheduledFromRow(row: ParsedRow): number | null {
  if (row.entradaEspMin == null || row.saidaEspMin == null) return null;
  const pause =
    row.pausaEspMin != null && row.retornoEspMin != null ? row.retornoEspMin - row.pausaEspMin : 0;
  const net = row.saidaEspMin - row.entradaEspMin - pause;
  return net > 0 ? net : null;
}

export interface AttendanceImportSummary {
  created: number;
  faltas: number;
  ferias: number;
  cargoConfiancaDetectados: number;
  unmatchedNames: string[];
  outros: { nome: string; texto: string }[];
  diasComJornadaAtualizada: number;
  horasEsperadasTotais: number;
  horasPerdidasTotais: number;
  ausenciasRegistradas: number;
  /** Ausências com atestado, declaração ou licença — contam como "com atestado" nos relatórios. */
  comAtestado: number;
  /** Dias em curso/aprendizagem — contados como cumpridos (não é falta), mesmo sem bater ponto. */
  cursoAprendizagem: number;
  /** Dias que não entram no cálculo de absenteísmo: férias, folga, feriado, sem jornada, abono, dispensa, cargo de confiança. */
  naoContabilizados: number;
}

const REASON_LABELS = {
  faltaInjustificada: "Falta injustificada",
  abono: "Abono autorizado pela gestão",
  compensada: "Falta compensada (banco de horas)",
  licenca: "Licença",
  atestadoMedico: "Atestado médico",
  declaracaoLabel: "Declaração",
  atraso: "Atraso",
  saidaAntecipada: "Saída antecipada",
  generico: "Ausência registrada no ponto",
  dispensa: "Dispensa",
} as const;

async function ensureReasons(): Promise<Record<keyof typeof REASON_LABELS, string>> {
  const labels = Object.values(REASON_LABELS);
  const existing = await prisma.reason.findMany({
    where: { category: "AFASTAMENTO", label: { in: labels } },
    select: { id: true, label: true },
  });
  const byLabel = new Map(existing.map((r) => [r.label, r.id]));

  const missing = labels.filter((l) => !byLabel.has(l));
  for (const label of missing) {
    const created = await prisma.reason.upsert({
      where: { category_label: { category: "AFASTAMENTO", label } },
      create: { category: "AFASTAMENTO", label },
      update: {},
    });
    byLabel.set(label, created.id);
  }

  const result = {} as Record<keyof typeof REASON_LABELS, string>;
  for (const key of Object.keys(REASON_LABELS) as (keyof typeof REASON_LABELS)[]) {
    result[key] = byLabel.get(REASON_LABELS[key])!;
  }
  return result;
}

export async function importAttendanceReport(
  rows: Record<string, string>[],
  nameOverrides: Record<string, string> = {}
): Promise<{ success: boolean; summary?: AttendanceImportSummary; error?: string }> {
  try {
    await requireHrAccess();
    if (rows.length === 0) return { success: false, error: "Nenhuma linha encontrada no arquivo." };

    const employees = await prisma.employee.findMany({
      select: { id: true, registration: true, name: true, isTrustPosition: true },
    });
    const byRegistration = new Map(employees.map((e) => [e.registration.trim(), e]));
    const byName = new Map(employees.map((e) => [normalizeName(e.name), e]));
    const employeesById = new Map(employees.map((e) => [e.id, e]));

    // Parse bruto de todas as linhas primeiro (precisamos disso pra calcular a "jornada
    // típica" de cada matrícula, usada como estimativa nos dias em que a rotina virou
    // "Dispensa" e o relatório não informa mais o horário esperado daquele dia).
    const parsedRows: ParsedRow[] = [];
    for (const row of rows) {
      const diaRaw = (row["Dia"] ?? "").toString();
      const date = parseReportDate(diaRaw);
      const rotina = (row["Rotina Esperada"] ?? "").toString().trim();
      if (!date || !rotina) continue;

      parsedRows.push({
        codigoRaw: (row["Código"] ?? "").toString().trim().replace(/\.0$/, ""),
        nomeRaw: (row["Nome"] ?? "").toString().trim(),
        date,
        rotina,
        setorNoDia: (row["Local de Trabalho Cadastrado"] ?? "").toString().trim() || null,
        hasEntrada: Boolean((row["Entrada"] ?? "").toString().trim()),
        atrasoMinutos: toMinutes(row["Atrasos"]),
        saidaAntecipadaMinutos: toMinutes(row["Saída Antecipada"]),
        obs: (row["Obs"] ?? "").toString().trim(),
        entradaEspMin: toMinutes(row["Entrada Esperada"]),
        saidaEspMin: toMinutes(row["Saída Esperada"]),
        pausaEspMin: toMinutes(row["Pausa Esperada"]),
        retornoEspMin: toMinutes(row["Retorno Esperado"]),
        duracaoMin: toMinutes(row["Duração"]),
      });
    }

    // Jornada típica por matrícula: moda das jornadas líquidas esperadas nos dias em
    // que o relatório informa horário esperado normal (não-Dispensa).
    const typicalByCodigo = new Map<string, number>();
    {
      const buckets = new Map<string, Map<number, number>>();
      for (const r of parsedRows) {
        const net = scheduledFromRow(r);
        if (net == null) continue;
        const counts = buckets.get(r.codigoRaw) ?? new Map<number, number>();
        counts.set(net, (counts.get(net) ?? 0) + 1);
        buckets.set(r.codigoRaw, counts);
      }
      for (const [codigo, counts] of buckets) {
        let best = 480;
        let bestCount = 0;
        for (const [net, count] of counts) {
          if (count > bestCount) {
            best = net;
            bestCount = count;
          }
        }
        typicalByCodigo.set(codigo, best);
      }
    }

    const reasons = await ensureReasons();

    // Absences já existentes no período do arquivo, pra reimportação não duplicar.
    const dates = parsedRows.map((r) => r.date.getTime());
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    const existingAbsences = await prisma.absence.findMany({
      where: { date: { gte: minDate, lte: maxDate } },
      select: { id: true, employeeId: true, date: true },
    });
    const absenceKey = (employeeId: string, date: Date) => `${employeeId}|${date.toISOString().slice(0, 10)}`;
    const existingAbsenceByKey = new Map(existingAbsences.map((a) => [absenceKey(a.employeeId, a.date), a.id]));

    const summary: AttendanceImportSummary = {
      created: 0,
      faltas: 0,
      ferias: 0,
      cargoConfiancaDetectados: 0,
      unmatchedNames: [],
      outros: [],
      diasComJornadaAtualizada: 0,
      horasEsperadasTotais: 0,
      horasPerdidasTotais: 0,
      ausenciasRegistradas: 0,
      comAtestado: 0,
      cursoAprendizagem: 0,
      naoContabilizados: 0,
    };
    const trustPositionIdsToSet = new Set<string>();

    async function processRow(row: ParsedRow) {
      const employee =
        byRegistration.get(row.codigoRaw) ??
        byName.get(normalizeName(row.nomeRaw)) ??
        (nameOverrides[row.nomeRaw] ? employeesById.get(nameOverrides[row.nomeRaw]) : undefined);
      if (!employee) {
        if (row.nomeRaw) summary.unmatchedNames.push(row.nomeRaw);
        return;
      }

      let status: AttendanceStatus = classifyAttendanceRow({
        rotinaEsperada: row.rotina,
        obs: row.obs,
        hasEntrada: row.hasEntrada,
      });

      if (status === "CARGO_CONFIANCA") {
        trustPositionIdsToSet.add(employee.id);
        summary.cargoConfiancaDetectados += 1;
      }
      if (employee.isTrustPosition) status = "CARGO_CONFIANCA";

      const writes: Promise<unknown>[] = [
        prisma.attendanceRecord.upsert({
          where: { employeeId_date: { employeeId: employee.id, date: row.date } },
          create: {
            employeeId: employee.id,
            date: row.date,
            status,
            rawRotina: row.rotina,
            setorNoDia: row.setorNoDia,
            atrasoMinutos: row.atrasoMinutos,
          },
          update: { status, rawRotina: row.rotina, setorNoDia: row.setorNoDia, atrasoMinutos: row.atrasoMinutos },
        }),
      ];

      summary.created += 1;
      if (status === "FALTOU") summary.faltas += 1;
      if (status === "FERIAS") summary.ferias += 1;
      if (status === "OUTRO") summary.outros.push({ nome: employee.name, texto: row.rotina });

      // Dias que NÃO entram no cálculo de absenteísmo (nem como jornada esperada,
      // nem como falta): férias, folga, feriado, sem jornada, cargo de confiança,
      // abono autorizado pela gestão (foi acordado, não é falta), dispensa (o
      // colaborador foi desligado, não é ausência) e texto não reconhecido.
      // Curso/Aprendizagem é diferente: entra como jornada esperada normalmente,
      // mas as horas contam como cumpridas (ver workedMin abaixo) — o colaborador
      // não bateu ponto, mas também não faltou, só estava em outro lugar.
      const NAO_CONTABILIZADOS: AttendanceStatus[] = [
        "FERIAS",
        "FOLGA",
        "FERIADO",
        "SEM_JORNADA",
        "CARGO_CONFIANCA",
        "ABONO",
        "DISPENSADO",
        "OUTRO",
      ];
      const isWorkday = !NAO_CONTABILIZADOS.includes(status);
      if (!isWorkday) summary.naoContabilizados += 1;

      if (isWorkday) {
        const scheduledMin = scheduledFromRow(row) ?? typicalByCodigo.get(row.codigoRaw) ?? 480;
        const workedMin =
          status === "PRESENTE"
            ? row.duracaoMin ?? 0
            : status === "CURSO_APRENDIZAGEM"
              ? scheduledMin // no curso: conta como cumprido mesmo sem bater ponto
              : 0;
        const rawLostMin = Math.max(0, scheduledMin - workedMin);
        const lostMin = rawLostMin >= TOLERANCIA_MIN ? rawLostMin : 0;

        if (status === "CURSO_APRENDIZAGEM") summary.cursoAprendizagem += 1;

        writes.push(
          prisma.timeEntry.upsert({
            where: { date_employeeId: { date: row.date, employeeId: employee.id } },
            create: {
              date: row.date,
              employeeId: employee.id,
              scheduledHours: scheduledMin / 60,
              workedHours: workedMin / 60,
              overtimeHours: 0,
              overtimeCost: 0,
              bankHoursDelta: 0,
            },
            update: {
              scheduledHours: scheduledMin / 60,
              workedHours: workedMin / 60,
            },
          })
        );
        summary.diasComJornadaAtualizada += 1;
        summary.horasEsperadasTotais += scheduledMin / 60;

        if (lostMin > 0) {
          summary.horasPerdidasTotais += lostMin / 60;

          // Licença, Atestado médico e Declaração são as 3 formas de ausência
          // "com documento" — por isso marcam hasCertificate: true. Todo o resto
          // que chega até aqui (Falta / Presente com atraso ou saída antecipada)
          // fica sem atestado. "Falta injustificada" só é usada quando o status
          // realmente for FALTOU — nunca como motivo padrão de fallback.
          let reasonId = reasons.generico;
          let hasCertificate = false;

          if (status === "FALTOU") {
            reasonId = reasons.faltaInjustificada;
          } else if (status === "LICENCA") {
            reasonId = reasons.licenca;
            hasCertificate = true;
          } else if (status === "ATESTADO") {
            reasonId = reasons.atestadoMedico;
            hasCertificate = true;
          } else if (status === "DECLARACAO") {
            reasonId = reasons.declaracaoLabel;
            hasCertificate = true;
          } else if (status === "PRESENTE") {
            reasonId = (row.atrasoMinutos ?? 0) > 0
              ? reasons.atraso
              : (row.saidaAntecipadaMinutos ?? 0) > 0
                ? reasons.saidaAntecipada
                : reasons.generico;
          }

          if (hasCertificate) summary.comAtestado += 1;

          const key = absenceKey(employee.id, row.date);
          const existingId = existingAbsenceByKey.get(key);
          writes.push(
            existingId
              ? prisma.absence.update({
                  where: { id: existingId },
                  data: { reasonId, hoursLost: lostMin / 60, hasCertificate },
                })
              : prisma.absence.create({
                  data: {
                    employeeId: employee.id,
                    date: row.date,
                    reasonId,
                    hoursLost: lostMin / 60,
                    hasCertificate,
                    absenceType: lostMin >= scheduledMin ? "UM_DIA_OU_MAIS" : "ALGUMAS_HORAS",
                  },
                })
          );
          summary.ausenciasRegistradas += 1;
        }
      }

      await Promise.all(writes);
    }

    // Processa em lotes paralelos (em vez de uma linha por vez) — com ~4500 linhas,
    // processar sequencialmente demoraria minutos e estouraria o tempo limite da função.
    const CHUNK_SIZE = 15;
    for (let i = 0; i < parsedRows.length; i += CHUNK_SIZE) {
      const chunk = parsedRows.slice(i, i + CHUNK_SIZE);
      await Promise.all(chunk.map(processRow));
    }

    if (trustPositionIdsToSet.size > 0) {
      await prisma.employee.updateMany({
        where: { id: { in: Array.from(trustPositionIdsToSet) } },
        data: { isTrustPosition: true },
      });
    }

    summary.horasEsperadasTotais = Math.round(summary.horasEsperadasTotais * 10) / 10;
    summary.horasPerdidasTotais = Math.round(summary.horasPerdidasTotais * 10) / 10;

    revalidatePath("/modulos/absenteismo");
    revalidatePath("/modulos/jornada");
    return { success: true, summary };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao importar o relatório de ponto." };
  }
}
