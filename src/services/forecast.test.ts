import { describe, it, expect } from "vitest";
import { linearForecast, trendDirection } from "@/services/forecast";

describe("linearForecast", () => {
  it("projeta corretamente uma série perfeitamente linear crescente", () => {
    const forecast = linearForecast([100, 110, 120, 130], 3);
    expect(forecast[0]).toBeCloseTo(140, 0);
    expect(forecast[1]).toBeCloseTo(150, 0);
    expect(forecast[2]).toBeCloseTo(160, 0);
  });

  it("projeta o mesmo valor para uma série constante", () => {
    const forecast = linearForecast([50, 50, 50, 50], 2);
    expect(forecast[0]).toBeCloseTo(50, 0);
    expect(forecast[1]).toBeCloseTo(50, 0);
  });

  it("nunca projeta valores negativos mesmo com queda acentuada", () => {
    const forecast = linearForecast([10, 5, 1], 3);
    expect(forecast.every((v) => v >= 0)).toBe(true);
  });

  it("não quebra com uma série de um único valor", () => {
    const forecast = linearForecast([42], 2);
    expect(forecast).toEqual([42, 42]);
  });

  it("não quebra com uma série vazia", () => {
    const forecast = linearForecast([], 2);
    expect(forecast).toHaveLength(2);
  });
});

describe("trendDirection", () => {
  it("classifica variação pequena como estável", () => {
    expect(trendDirection([100, 101, 102])).toBe("flat");
  });

  it("classifica crescimento forte como alta", () => {
    expect(trendDirection([100, 130, 160])).toBe("up");
  });

  it("classifica queda forte como baixa", () => {
    expect(trendDirection([100, 70, 40])).toBe("down");
  });
});
