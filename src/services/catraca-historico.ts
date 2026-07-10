import { prisma } from "@/lib/prisma";

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
 * por dia) a partir dos resumos importados em TurnstileDailySummary — a
 * mesma visão da aba "Comparação" da ferramenta anterior.
 */
export async function getCatracaHistorico(): Promise<HistoricoResult> {
  const summaries = await prisma.turnstileDailySummary.findMany({
    orderBy: { date: "asc" },
  });

  if (summaries.length === 0) return { dates: [], rows: [] };

  const dateSet = new Set<string>();
  const byEmployee = new Map<string, { employeeId: string | null; byDate: Record<string, number> }>();

  for (const s of summaries) {
    const dateKey = s.date.toISOString().slice(0, 10);
    dateSet.add(dateKey);
    const key = s.employeeName;
    const entry = byEmployee.get(key) ?? { employeeId: s.employeeId, byDate: {} };
    entry.byDate[dateKey] = s.minutesAway;
    if (s.employeeId) entry.employeeId = s.employeeId;
    byEmployee.set(key, entry);
  }

  const dates = Array.from(dateSet).sort();

  const rows: HistoricoRow[] = Array.from(byEmployee.entries())
    .map(([employeeName, v]) => {
      const byDate: Record<string, number | null> = {};
      for (const d of dates) byDate[d] = v.byDate[d] ?? null;

      const firstVal = dates.map((d) => byDate[d]).find((val) => val !== null) ?? null;
      const lastVal = [...dates].reverse().map((d) => byDate[d]).find((val) => val !== null) ?? null;
      let trend: HistoricoRow["trend"] = null;
      if (firstVal !== null && lastVal !== null) {
        const delta = lastVal - firstVal;
        trend = delta > 5 ? "up" : delta < -5 ? "down" : "flat";
      }

      return { employeeName, employeeId: v.employeeId, byDate, trend };
    })
    .sort((a, b) => {
      const lastDate = dates[dates.length - 1];
      return (b.byDate[lastDate] ?? -1) - (a.byDate[lastDate] ?? -1);
    });

  return { dates, rows };
}
