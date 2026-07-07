import { describe, it, expect } from "vitest";
import { calculateBradfordFactor } from "@/lib/analytics/bradford";

describe("calculateBradfordFactor", () => {
  it("classifica 1 ocorrência de 10 dias como normal (B=10)", () => {
    const result = calculateBradfordFactor(1, 10 * 8);
    expect(result.bradfordScore).toBe(10);
    expect(result.riskLevel).toBe("Normal");
  });

  it("classifica 10 ocorrências de 1 dia (mesmo total) como crítico (B=1000)", () => {
    const result = calculateBradfordFactor(10, 10 * 8);
    expect(result.bradfordScore).toBe(1000);
    expect(result.riskLevel).toBe("Crítico");
  });

  it("mesmo total de dias produz scores muito diferentes conforme a fragmentação", () => {
    const consolidated = calculateBradfordFactor(1, 80);
    const fragmented = calculateBradfordFactor(10, 80);
    expect(fragmented.bradfordScore).toBeGreaterThan(consolidated.bradfordScore);
  });

  it("classifica score na faixa de atenção (50-449)", () => {
    const result = calculateBradfordFactor(3, 6 * 8); // 3² × 6 = 54
    expect(result.riskLevel).toBe("Atenção");
  });
});
