import { describe, it, expect } from "vitest";
import { pairTurnstileGaps, pairTurnstileGapsDetailed } from "@/lib/analytics/turnstile";

// Lembrete do sentido da catraca (ver comentário grande em turnstile.ts):
// "Entrada" = colaborador SAINDO do posto; "Saída" = colaborador VOLTANDO ao
// posto. Um dia normal (só chegada de manhã + saída no fim do expediente)
// deve ser representado como "Saída" (chegada/volta ao posto) seguida de
// "Entrada" (saída no fim do dia) — nessa ordem só existe um par válido
// quando é "Entrada" IMEDIATAMENTE seguida de "Saída" no array ordenado por
// horário, então uma sequência Saída→Entrada nunca fecha par.
function ev(employeeId: string, dateStr: string, direction: string) {
  return { employeeId, direction, timestamp: new Date(dateStr) };
}

describe("pairTurnstileGaps", () => {
  it("não gera tempo fora do posto em dias normais (só chegada de manhã e saída no fim do dia)", () => {
    const events = [
      ev("E1", "2026-06-01T07:50:00", "SAIDA"), // chegada (volta ao posto)
      ev("E1", "2026-06-01T17:10:00", "ENTRADA"), // saída no fim do dia (sai do posto)
      ev("E1", "2026-06-02T07:55:00", "SAIDA"),
      ev("E1", "2026-06-02T17:05:00", "ENTRADA"),
    ];
    expect(pairTurnstileGaps(events).has("E1")).toBe(false);
  });

  it("não soma a virada de um dia para o outro como tempo fora do posto (regressão do bug original)", () => {
    const events = [];
    for (let d = 1; d <= 10; d++) {
      const dd = String(d).padStart(2, "0");
      events.push(ev("E2", `2026-06-${dd}T07:50:00`, "SAIDA"));
      events.push(ev("E2", `2026-06-${dd}T17:10:00`, "ENTRADA"));
    }
    expect(pairTurnstileGaps(events).has("E2")).toBe(false);
  });

  it("calcula corretamente uma pausa acima do padrão, fora da janela de almoço (90min - 60min = 30min excedente)", () => {
    const events = [
      ev("E3", "2026-06-01T14:00:00", "ENTRADA"), // sai do posto
      ev("E3", "2026-06-01T15:30:00", "SAIDA"), // volta 90min depois
    ];
    const result = pairTurnstileGaps(events).get("E3");
    expect(result?.minutesOut).toBe(30);
    expect(result?.occurrences).toBe(1);
  });

  it("ignora pausas de 65 minutos (abaixo do limiar de 70min)", () => {
    const events = [
      ev("E4", "2026-06-01T09:00:00", "ENTRADA"),
      ev("E4", "2026-06-01T10:05:00", "SAIDA"), // 65min
    ];
    expect(pairTurnstileGaps(events).has("E4")).toBe(false);
  });

  it("soma múltiplas pausas no mesmo dia", () => {
    const events = [
      ev("E5", "2026-06-01T09:00:00", "ENTRADA"),
      ev("E5", "2026-06-01T10:20:00", "SAIDA"), // 80min -> 20min excedente
      ev("E5", "2026-06-01T15:00:00", "ENTRADA"),
      ev("E5", "2026-06-01T16:30:00", "SAIDA"), // 90min -> 30min excedente
    ];
    const result = pairTurnstileGaps(events).get("E5");
    expect(result?.minutesOut).toBe(50);
    expect(result?.occurrences).toBe(2);
  });
});

describe("pairTurnstileGapsDetailed", () => {
  it("devolve uma linha por ocorrência contada, com o horário de saída do posto", () => {
    const events = [
      ev("E6", "2026-06-01T09:00:00", "ENTRADA"),
      ev("E6", "2026-06-01T10:20:00", "SAIDA"), // 80min -> 20min excedente
      ev("E6", "2026-06-01T15:00:00", "ENTRADA"),
      ev("E6", "2026-06-01T16:30:00", "SAIDA"), // 90min -> 30min excedente
    ];
    const details = pairTurnstileGapsDetailed(events);
    expect(details).toHaveLength(2);
    expect(details[0].entrada.toISOString()).toBe(new Date("2026-06-01T09:00:00").toISOString());
    expect(details[0].minutesOut).toBe(20);
    expect(details[1].minutesOut).toBe(30);
  });

  it("não inclui pares cujo retorno cai na janela de almoço nem os abaixo do limiar de 70min", () => {
    const events = [
      ev("E7", "2026-06-01T09:00:00", "ENTRADA"),
      ev("E7", "2026-06-01T12:10:00", "SAIDA"), // retorno 12:10 -> dentro da janela de almoço, ignorado
      ev("E7", "2026-06-01T14:00:00", "ENTRADA"),
      ev("E7", "2026-06-01T15:05:00", "SAIDA"), // 65min -> abaixo do limiar, ignorado
    ];
    expect(pairTurnstileGapsDetailed(events)).toHaveLength(0);
  });

  it("agrupa o total de ocorrências por hora do dia (horário de saída do posto)", () => {
    const events = [
      ev("E8", "2026-06-01T14:00:00", "ENTRADA"),
      ev("E8", "2026-06-01T15:20:00", "SAIDA"), // saída do posto às 14h -> 80min -> 20min excedente
      ev("E9", "2026-06-02T14:10:00", "ENTRADA"),
      ev("E9", "2026-06-02T15:25:00", "SAIDA"), // saída do posto às 14h -> 75min -> 15min excedente
    ];
    const details = pairTurnstileGapsDetailed(events);
    const byHour = new Map<number, number>();
    for (const d of details) byHour.set(d.entrada.getHours(), (byHour.get(d.entrada.getHours()) ?? 0) + 1);
    expect(byHour.get(14)).toBe(2);
  });
});
