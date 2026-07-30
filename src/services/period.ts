export type PeriodKey = "30d" | "90d" | "12m" | "ytd" | "all" | string;

export interface DateRange {
  start: Date;
  end: Date;
  months: number;
}

/** Primeiro ano com dados no sistema — usado como início do período "Todos". */
const EARLIEST_DATA_YEAR = 2000;

export function resolvePeriod(period: string | undefined): DateRange {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);

  // Ano específico: período recebido é só um número de 4 dígitos, ex. "2024".
  if (period && /^\d{4}$/.test(period)) {
    const year = Number(period);
    const yearStart = new Date(year, 0, 1, 0, 0, 0, 0);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
    return { start: yearStart, end: yearEnd, months: 12 };
  }

  switch (period) {
    case "30d":
      start.setDate(start.getDate() - 30);
      return { start, end, months: 1 };
    case "90d":
      start.setDate(start.getDate() - 90);
      return { start, end, months: 3 };
    case "ytd":
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      return { start, end, months: end.getMonth() + 1 };
    case "all": {
      const allStart = new Date(EARLIEST_DATA_YEAR, 0, 1, 0, 0, 0, 0);
      const months = (end.getFullYear() - EARLIEST_DATA_YEAR) * 12 + end.getMonth() + 1;
      return { start: allStart, end, months };
    }
    case "12m":
    default:
      start.setMonth(start.getMonth() - 12);
      return { start, end, months: 12 };
  }
}

export function previousPeriod(range: DateRange): DateRange {
  const spanMs = range.end.getTime() - range.start.getTime();
  const end = new Date(range.start.getTime() - 1);
  const start = new Date(end.getTime() - spanMs);
  return { start, end, months: range.months };
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export function lastNMonthsKeys(n: number): string[] {
  const keys: string[] = [];
  const cursor = new Date();
  cursor.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
    keys.push(monthKey(d));
  }
  return keys;
}

/**
 * Meses a exibir em gráficos mensais, de acordo com o período selecionado:
 * - Ano específico (ex.: "2026"): mostra janeiro até o mês atual (se for o ano
 *   corrente) ou até dezembro (se for um ano fechado). Evita exibir meses
 *   futuros ainda sem dados como se fossem "0% de absenteísmo".
 * - Qualquer outro período: mantém o comportamento padrão de últimos 12 meses.
 */
export function monthKeysForPeriod(period?: string): string[] {
  if (period && /^\d{4}$/.test(period)) {
    const year = Number(period);
    const now = new Date();
    const lastMonthIndex = year === now.getFullYear() ? now.getMonth() : 11;
    const keys: string[] = [];
    for (let m = 0; m <= lastMonthIndex; m++) {
      keys.push(`${year}-${String(m + 1).padStart(2, "0")}`);
    }
    return keys;
  }
  return lastNMonthsKeys(12);
}

export function monthLabelsPtBR(keys: string[]): string[] {
  const fmt = new Intl.DateTimeFormat("pt-BR", { month: "short" });
  return keys.map((key) => {
    const [y, m] = key.split("-").map(Number);
    return fmt.format(new Date(y, m - 1, 1)).replace(".", "");
  });
}
export function percentDelta(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 1;
  return (current - previous) / previous;
}
