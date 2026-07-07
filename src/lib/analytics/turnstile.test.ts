import { describe, it, expect } from "vitest";
import { pairTurnstileGaps } from "@/lib/analytics/turnstile";

function ev(employeeId: string, dateStr: string, direction: string) {
  return { employeeId, direction, timestamp: new Date(dateStr) };
}

describe("pairTurnstileGaps", () => {
  it("não gera tempo fora do posto em dias normais (sem par SAÍDA→ENTRADA no mesmo dia)", () => {
    const events = [
      ev("E1", "2026-06-01T07:50:00", "ENTRADA"),
      ev("E1", "2026-06-01T17:10:00", "SAIDA"),
      ev("E1", "2026-06-02T07:55:00", "ENTRADA"),
      ev("E1", "2026-06-02T17:05:00", "SAIDA"),
    ];
    expect(pairTurnstileGaps(events).has("E1")).toBe(false);
  });

  it("não soma a virada de um dia para o outro como tempo fora do posto (regressão do bug original)", () => {
    const events = [];
    for (let d = 1; d <= 10; d++) {
      const dd = String(d).padStart(2, "0");
      events.push(ev("E2", `2026-06-${dd}T07:50:00`, "ENTRADA"));
      events.push(ev("E2", `2026-06-${dd}T17:10:00`, "SAIDA"));
    }
    expect(pairTurnstileGaps(events).has("E2")).toBe(false);
  });

  it("calcula corretamente uma pausa de almoço acima do padrão (90min - 60min = 30min excedente)", () => {
    const events = [
      ev("E3", "2026-06-01T07:50:00", "ENTRADA"),
      ev("E3", "2026-06-01T12:00:00", "SAIDA"),
      ev("E3", "2026-06-01T13:30:00", "ENTRADA"),
      ev("E3", "2026-06-01T17:10:00", "SAIDA"),
    ];
    const result = pairTurnstileGaps(events).get("E3");
    expect(result?.minutesOut).toBe(30);
    expect(result?.occurrences).toBe(1);
  });

  it("ignora pausas de 65 minutos (abaixo do limiar de 70min)", () => {
    const events = [ev("E4", "2026-06-01T12:00:00", "SAIDA"), ev("E4", "2026-06-01T13:05:00", "ENTRADA")];
    expect(pairTurnstileGaps(events).has("E4")).toBe(false);
  });

  it("soma múltiplas pausas no mesmo dia", () => {
    const events = [
      ev("E5", "2026-06-01T10:00:00", "SAIDA"),
      ev("E5", "2026-06-01T11:20:00", "ENTRADA"), // 80min -> 20min excedente
      ev("E5", "2026-06-01T15:00:00", "SAIDA"),
      ev("E5", "2026-06-01T16:30:00", "ENTRADA"), // 90min -> 30min excedente
    ];
    const result = pairTurnstileGaps(events).get("E5");
    expect(result?.minutesOut).toBe(50);
    expect(result?.occurrences).toBe(2);
  });
});
