export interface TurnstileEventLike {
  employeeId: string;
  timestamp: Date;
  direction: string;
}

/**
 * Calcula o tempo fora do posto por colaborador a partir de eventos de catraca.
 * Regra: só considera pares SAÍDA → ENTRADA dentro do MESMO DIA (evita contar a
 * janela noturna entre o fim de um expediente e o início do próximo como "tempo
 * fora do posto"). Função pura — sem I/O — para permitir teste unitário isolado.
 */
export interface DailyMinutesOut {
  employeeId: string;
  date: Date;
  minutesOut: number;
}

/**
 * Igual ao pairTurnstileGaps, mas devolve o detalhamento dia a dia (em vez de
 * somar tudo num único total) — usado na comparação histórica por dia.
 */
export function pairTurnstileGapsByDay(events: TurnstileEventLike[]): DailyMinutesOut[] {
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

  const byEmployeeDay = new Map<string, TurnstileEventLike[]>();
  for (const ev of events) {
    const key = `${ev.employeeId}__${dayKey(ev.timestamp)}`;
    const list = byEmployeeDay.get(key) ?? [];
    list.push(ev);
    byEmployeeDay.set(key, list);
  }

  const results: DailyMinutesOut[] = [];
  for (const [key, list] of byEmployeeDay) {
    const [employeeId] = key.split("__");
    const sorted = [...list].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    let minutesOut = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].direction === "SAIDA" && sorted[i + 1].direction === "ENTRADA") {
        const diffMin = (sorted[i + 1].timestamp.getTime() - sorted[i].timestamp.getTime()) / 60000;
        if (diffMin > 70) minutesOut += diffMin - 60;
      }
    }

    if (minutesOut > 0) {
      const d = sorted[0].timestamp;
      results.push({ employeeId, date: new Date(d.getFullYear(), d.getMonth(), d.getDate()), minutesOut: Math.round(minutesOut) });
    }
  }

  return results;
}

export function pairTurnstileGaps(events: TurnstileEventLike[]): Map<string, { minutesOut: number; occurrences: number }> {
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

  const byEmployeeDay = new Map<string, TurnstileEventLike[]>();
  for (const ev of events) {
    const key = `${ev.employeeId}__${dayKey(ev.timestamp)}`;
    const list = byEmployeeDay.get(key) ?? [];
    list.push(ev);
    byEmployeeDay.set(key, list);
  }

  const totals = new Map<string, { minutesOut: number; occurrences: number }>();
  for (const [key, list] of byEmployeeDay) {
    const employeeId = key.split("__")[0];
    const sorted = [...list].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    let minutesOut = 0;
    let occurrences = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].direction === "SAIDA" && sorted[i + 1].direction === "ENTRADA") {
        const diffMin = (sorted[i + 1].timestamp.getTime() - sorted[i].timestamp.getTime()) / 60000;
        if (diffMin > 70) {
          minutesOut += diffMin - 60;
          occurrences += 1;
        }
      }
    }

    if (minutesOut > 0) {
      const cur = totals.get(employeeId) ?? { minutesOut: 0, occurrences: 0 };
      cur.minutesOut += minutesOut;
      cur.occurrences += occurrences;
      totals.set(employeeId, cur);
    }
  }

  return totals;
}
