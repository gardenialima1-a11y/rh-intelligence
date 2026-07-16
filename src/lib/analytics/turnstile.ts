export interface TurnstileEventLike {
  employeeId: string;
  timestamp: Date;
  direction: string;
}

// Almoço: qualquer volta ("Saída" — reentrada na fábrica) dentro dessa janela
// não conta como tempo fora do posto, seja qual for a duração.
const LUNCH_START_MIN = 11 * 60; // 11:00
const LUNCH_END_MIN = 12 * 60 + 42; // 12:42

function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function isReturnDuringLunch(d: Date): boolean {
  const m = minutesOfDay(d);
  return m >= LUNCH_START_MIN && m <= LUNCH_END_MIN;
}

/**
 * IMPORTANTE — sentido da catraca desta empresa (confirmado pela cliente):
 * "Saída" = entrando na fábrica/posto de trabalho (chegada, volta do almoço,
 * volta de qualquer pausa). "Entrada" = saindo do posto em direção ao
 * vestiário (início de pausa, almoço, ida embora no fim do dia).
 * Ou seja, o tempo fora do posto é o intervalo "Entrada" (saiu) → "Saída"
 * (voltou) — o contrário do que os nomes sugerem à primeira vista.
 *
 * Regras aplicadas:
 * - Só pares Entrada → Saída no MESMO DIA contam.
 * - Se a "Saída" (volta) cair na janela de almoço (11h00–12h42), o par
 *   inteiro é ignorado — não entra no cálculo, mesmo que a pausa tenha
 *   durado mais que o normal.
 * - Fora da janela de almoço, só conta o que passar de 70min, descontando
 *   60min de tolerância (mesma regra de antes para pausas fora do horário
 *   de almoço).
 * - A primeira "Saída" do dia (chegada) nunca fecha um par sozinha — não
 *   tem "Entrada" antes dela no mesmo dia, então fica de fora naturalmente.
 */
export interface DailyMinutesOut {
  employeeId: string;
  date: Date;
  minutesOut: number;
}

function computeDayMinutesOut(sorted: TurnstileEventLike[]): { minutesOut: number; occurrences: number } {
  let minutesOut = 0;
  let occurrences = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].direction === "ENTRADA" && sorted[i + 1].direction === "SAIDA") {
      const returnEvent = sorted[i + 1];
      if (isReturnDuringLunch(returnEvent.timestamp)) continue;

      const diffMin = (returnEvent.timestamp.getTime() - sorted[i].timestamp.getTime()) / 60000;
      if (diffMin > 70) {
        minutesOut += diffMin - 60;
        occurrences += 1;
      }
    }
  }
  return { minutesOut, occurrences };
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

    const { minutesOut } = computeDayMinutesOut(sorted);

    if (minutesOut > 0) {
      const d = sorted[0].timestamp;
      results.push({ employeeId, date: new Date(d.getFullYear(), d.getMonth(), d.getDate()), minutesOut: Math.round(minutesOut) });
    }
  }

  return results;
}

export interface PairExplanation {
  entrada: Date | null;
  saida: Date | null;
  rawMinutes: number | null;
  countedMinutes: number;
  status: "contado" | "almoco_ignorado" | "abaixo_do_limite" | "sem_par";
}

/**
 * Mesma lógica de computeDayMinutesOut, mas devolve o passo a passo de cada
 * par Entrada→Saída (contado, ignorado por almoço, abaixo do limite de
 * 70min, ou evento avulso sem par) — usado pra investigar um dia específico
 * de um colaborador quando o número parecer estranho.
 */
export function explainDayPairs(events: TurnstileEventLike[]): PairExplanation[] {
  const sorted = [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const explanations: PairExplanation[] = [];
  const usedIndexes = new Set<number>();

  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].direction === "ENTRADA" && sorted[i + 1].direction === "SAIDA") {
      usedIndexes.add(i);
      usedIndexes.add(i + 1);
      const entrada = sorted[i].timestamp;
      const saida = sorted[i + 1].timestamp;
      const diffMin = (saida.getTime() - entrada.getTime()) / 60000;

      if (isReturnDuringLunch(saida)) {
        explanations.push({ entrada, saida, rawMinutes: Math.round(diffMin), countedMinutes: 0, status: "almoco_ignorado" });
      } else if (diffMin > 70) {
        explanations.push({ entrada, saida, rawMinutes: Math.round(diffMin), countedMinutes: Math.round(diffMin - 60), status: "contado" });
      } else {
        explanations.push({ entrada, saida, rawMinutes: Math.round(diffMin), countedMinutes: 0, status: "abaixo_do_limite" });
      }
    }
  }

  for (let i = 0; i < sorted.length; i++) {
    if (!usedIndexes.has(i)) {
      const isEntrada = sorted[i].direction === "ENTRADA";
      explanations.push({
        entrada: isEntrada ? sorted[i].timestamp : null,
        saida: isEntrada ? null : sorted[i].timestamp,
        rawMinutes: null,
        countedMinutes: 0,
        status: "sem_par",
      });
    }
  }

  return explanations.sort((a, b) => (a.entrada ?? a.saida ?? new Date(0)).getTime() - (b.entrada ?? b.saida ?? new Date(0)).getTime());
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

    const { minutesOut, occurrences } = computeDayMinutesOut(sorted);

    if (minutesOut > 0) {
      const cur = totals.get(employeeId) ?? { minutesOut: 0, occurrences: 0 };
      cur.minutesOut += minutesOut;
      cur.occurrences += occurrences;
      totals.set(employeeId, cur);
    }
  }

  return totals;
}
