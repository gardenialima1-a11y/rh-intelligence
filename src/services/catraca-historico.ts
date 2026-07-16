import { prisma } from "@/lib/prisma";
import { pairTurnstileGapsByDay } from "@/lib/analytics/turnstile";

export interface HistoricoRow {
  employeeName: string;
  employeeId: string | null;
  byDate: Record<string, number | null>;
  trend: "up" | "down" | "flat" | null;
}

export interface HistoricoResult {
  dates: string[];
  rows: HistoricoRow[];
}

/**
 * Monta a tabela de comparação diária (uma linha por colaborador, uma coluna
 * por dia), juntando DUAS fontes: o histórico antigo importado direto em
 * TurnstileDailySummary, e os relatórios de ponto/catraca novos que você
 * importa pela tela (TurnstileEvent) — assim, cada nova importação continua
 * alimentando esse comparativo, em vez de ficar parado no histórico antigo.
 * Quando o colaborador está cadastrado (employeeId preenchido), as duas
 * fontes se juntam numa linha só; sem isso, cada nome vira sua própria linha.
 */
export async function getCatracaHistorico(): Promise<HistoricoResult> {
  const [summaries, events] = await Promise.all([
    prisma.turnstileDailySummary.findMany({ orderBy: { date: "asc" } }),
    prisma.turnstileEvent.findMany({
      select: { employeeId: true, timestamp: true, direction: true },
      orderBy: { timestamp: "asc" },
    }),
  ]);

  if (summaries.length === 0 && events.length === 0) return { dates: [], rows: [] };

  const dateSet = new Set<string>();
  const byKey = new Map<string, { employeeId: string | null; employeeName: string; byDate: Record<string, number> }>();

  for (const s of summaries) {
    const dateKey = s.date.toISOString().slice(0, 10);
    dateSet.add(dateKey);
    const key = s.employeeId ?? `nome:${s.employeeName}`;
    const entry = byKey.get(key) ?? { employeeId: s.employeeId, employeeName: s.employeeName, byDate: {} };
    entry.byDate[dateKey] = (entry.byDate[dateKey] ?? 0) + s.minutesAway;
    byKey.set(key, entry);
  }

  const dailyFromEvents = pairTurnstileGapsByDay(
    events.map((e) => ({ employeeId: e.employeeId, timestamp: e.timestamp, direction: e.direction }))
  );

  if (dailyFromEvents.length > 0) {
    const employeeIds = Array.from(new Set(dailyFromEvents.map((d) => d.employeeId)));
    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: { id: true, name: true },
    });
    const nameById = new Map(employees.map((e) => [e.id, e.name]));

    for (const d of dailyFromEvents) {
      const dateKey = d.date.toISOString().slice(0, 10);
      dateSet.add(dateKey);
      const key = d.employeeId;
      const entry: { employeeId: string | null; employeeName: string; byDate: Record<string, number> } =
        byKey.get(key) ?? { employeeId: d.employeeId, employeeName: nameById.get(d.employeeId) ?? "—", byDate: {} };
      entry.employeeName = nameById.get(d.employeeId) ?? entry.employeeName;
      entry.byDate[dateKey] = (entry.byDate[dateKey] ?? 0) + d.minutesOut;
      byKey.set(key, entry);
    }
  }

  const dates = Array.from(dateSet).sort();

  const rows: HistoricoRow[] = Array.from(byKey.values())
    .map((v) => {
      const byDate: Record<string, number | null> = {};
      for (const d of dates) byDate[d] = v.byDate[d] ?? null;

      const firstVal = dates.map((d) => byDate[d]).find((val) => val !== null) ?? null;
      const lastVal = [...dates].reverse().map((d) => byDate[d]).find((val) => val !== null) ?? null;
      let trend: HistoricoRow["trend"] = null;
      if (firstVal !== null && lastVal !== null) {
        const delta = lastVal - firstVal;
        trend = delta > 5 ? "up" : delta < -5 ? "down" : "flat";
      }

      return { employeeName: v.employeeName, employeeId: v.employeeId, byDate, trend };
    })
    .sort((a, b) => {
      const lastDate = dates[dates.length - 1];
      return (b.byDate[lastDate] ?? -1) - (a.byDate[lastDate] ?? -1);
    });

  return { dates, rows };
}
