import { describe, it, expect } from "vitest";
import { resolvePeriod, previousPeriod, percentDelta, lastNMonthsKeys, monthLabelsPtBR, monthKey } from "@/services/period";

describe("resolvePeriod", () => {
  it("retorna um intervalo de ~30 dias para '30d'", () => {
    const r = resolvePeriod("30d");
    const diffDays = (r.end.getTime() - r.start.getTime()) / 86400000;
    expect(diffDays).toBeCloseTo(30, 0);
  });

  it("usa 12 meses como padrão quando period é undefined", () => {
    const r = resolvePeriod(undefined);
    expect(r.months).toBe(12);
  });

  it("'ytd' começa em 1º de janeiro do ano corrente", () => {
    const r = resolvePeriod("ytd");
    expect(r.start.getMonth()).toBe(0);
    expect(r.start.getDate()).toBe(1);
  });
});

describe("previousPeriod", () => {
  it("não sobrepõe o período atual e tem a mesma duração", () => {
    const current = resolvePeriod("30d");
    const prev = previousPeriod(current);
    expect(prev.end.getTime()).toBeLessThan(current.start.getTime());

    const currentDuration = current.end.getTime() - current.start.getTime();
    const prevDuration = prev.end.getTime() - prev.start.getTime();
    expect(Math.abs(currentDuration - prevDuration)).toBeLessThan(2000); // tolerância de ms
  });
});

describe("percentDelta", () => {
  it("calcula variação percentual corretamente", () => {
    expect(percentDelta(110, 100)).toBeCloseTo(0.1);
  });

  it("retorna 1 (100%) quando a base é 0 e o atual é positivo, sem dividir por zero", () => {
    expect(percentDelta(100, 0)).toBe(1);
  });

  it("retorna 0 quando ambos os valores são 0", () => {
    expect(percentDelta(0, 0)).toBe(0);
  });
});

describe("lastNMonthsKeys", () => {
  it("retorna N chaves únicas em ordem cronológica terminando no mês atual", () => {
    const keys = lastNMonthsKeys(12);
    expect(keys).toHaveLength(12);
    expect(new Set(keys).size).toBe(12);
    expect(keys[keys.length - 1]).toBe(monthKey(new Date()));
    expect([...keys].sort()).toEqual(keys);
  });
});

describe("monthLabelsPtBR", () => {
  it("preserva o tamanho do array e não inclui pontuação", () => {
    const keys = lastNMonthsKeys(6);
    const labels = monthLabelsPtBR(keys);
    expect(labels).toHaveLength(6);
    expect(labels.every((l) => !l.includes("."))).toBe(true);
  });
});
