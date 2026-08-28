import { describe, it, expect } from "vitest";
import {
  resolveHourlyRate,
  matchFaltaDeduction,
  classifyFaltaCruzamento,
  MONTHLY_HOURS_CLT,
} from "./custo-atestado";

describe("resolveHourlyRate", () => {
  it("usa o salário real da folha quando disponível (fonte FOLHA_REAL)", () => {
    const result = resolveHourlyRate({
      realMonthlySalary: 4400,
      positionFloor: 2000,
      positionCeil: 3000,
      fallbackMonthlySalary: 2500,
    });
    expect(result.source).toBe("FOLHA_REAL");
    expect(result.rate).toBeCloseTo(4400 / MONTHLY_HOURS_CLT);
  });

  it("cai para a faixa do cargo quando não há salário real na folha", () => {
    const result = resolveHourlyRate({
      realMonthlySalary: null,
      positionFloor: 2000,
      positionCeil: 3000,
      fallbackMonthlySalary: 2500,
    });
    expect(result.source).toBe("FAIXA_CARGO");
    expect(result.rate).toBeCloseTo(2500 / MONTHLY_HOURS_CLT);
  });

  it("cai para a média das faixas quando não há salário real nem faixa de cargo", () => {
    const result = resolveHourlyRate({
      realMonthlySalary: null,
      positionFloor: null,
      positionCeil: null,
      fallbackMonthlySalary: 2500,
    });
    expect(result.source).toBe("MEDIA_FAIXAS");
    expect(result.rate).toBeCloseTo(2500 / MONTHLY_HOURS_CLT);
  });

  it("trata salário real igual a zero como ausente (evita valor-hora zerado por dado ruim)", () => {
    const result = resolveHourlyRate({
      realMonthlySalary: 0,
      positionFloor: 2000,
      positionCeil: 2000,
      fallbackMonthlySalary: 2500,
    });
    expect(result.source).toBe("FAIXA_CARGO");
  });
});

describe("matchFaltaDeduction", () => {
  it("reconhece descontos de falta em variações comuns de descrição da folha", () => {
    const result = matchFaltaDeduction([
      { descricao: "FALTAS", valor: 91.2 },
      { descricao: "VALE TRANSPORTE", valor: 60 },
    ]);
    expect(result.matched).toBe(true);
    expect(result.totalValor).toBeCloseTo(91.2);
    expect(result.items).toHaveLength(1);
  });

  it("reconhece 'DSR S/FALTA' e 'DESC. FALTA INJUSTIFICADA'", () => {
    const result = matchFaltaDeduction([
      { descricao: "DSR S/FALTA", valor: 30 },
      { descricao: "DESC. FALTA INJUSTIFICADA", valor: 60 },
    ]);
    expect(result.matched).toBe(true);
    expect(result.totalValor).toBeCloseTo(90);
  });

  it("não confunde outros descontos (INSS, vale-transporte, empréstimo) com falta", () => {
    const result = matchFaltaDeduction([
      { descricao: "INSS", valor: 300 },
      { descricao: "VALE TRANSPORTE", valor: 60 },
      { descricao: "EMPRÉSTIMO CONSIGNADO 2/12 - C:1432", valor: 150 },
    ]);
    expect(result.matched).toBe(false);
    expect(result.totalValor).toBe(0);
  });

  it("soma múltiplos descontos de falta no mesmo mês", () => {
    const result = matchFaltaDeduction([
      { descricao: "FALTA", valor: 45 },
      { descricao: "FALTA", valor: 45 },
    ]);
    expect(result.totalValor).toBeCloseTo(90);
  });
});

describe("classifyFaltaCruzamento", () => {
  it("marca como INDETERMINADA quando não há folha detalhada daquele mês", () => {
    expect(classifyFaltaCruzamento(false, { matched: true })).toBe("INDETERMINADA");
    expect(classifyFaltaCruzamento(false, { matched: false })).toBe("INDETERMINADA");
  });

  it("marca como CONFIRMADA quando há folha detalhada e desconto de falta", () => {
    expect(classifyFaltaCruzamento(true, { matched: true })).toBe("CONFIRMADA");
  });

  it("marca como ABONADA quando há folha detalhada mas sem desconto de falta", () => {
    expect(classifyFaltaCruzamento(true, { matched: false })).toBe("ABONADA");
  });
});
