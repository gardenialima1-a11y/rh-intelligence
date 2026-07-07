import { describe, it, expect } from "vitest";
import { pearsonCorrelation } from "@/lib/analytics/correlation";

describe("pearsonCorrelation", () => {
  it("retorna 1 para correlação perfeita positiva", () => {
    expect(pearsonCorrelation([1, 2, 3, 4, 5], [2, 4, 6, 8, 10])).toBeCloseTo(1);
  });

  it("retorna -1 para correlação perfeita negativa", () => {
    expect(pearsonCorrelation([1, 2, 3, 4, 5], [10, 8, 6, 4, 2])).toBeCloseTo(-1);
  });

  it("retorna 0 (sem NaN) quando uma série não tem variância", () => {
    expect(pearsonCorrelation([1, 1, 1, 1], [5, 3, 8, 2])).toBe(0);
  });

  it("retorna 0 (sem erro) para arrays vazios", () => {
    expect(pearsonCorrelation([], [])).toBe(0);
  });
});
