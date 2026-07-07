import { describe, it, expect } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("retorna string vazia para array vazio", () => {
    expect(toCsv([])).toBe("");
  });

  it("gera cabeçalho a partir das chaves quando columns não é informado", () => {
    const csv = toCsv([{ nome: "Ana", idade: 30 }]);
    const lines = csv.replace("\uFEFF", "").split("\r\n");
    expect(lines[0]).toBe("nome;idade");
    expect(lines[1]).toBe("Ana;30");
  });

  it("usa os rótulos customizados quando columns é informado", () => {
    const csv = toCsv([{ nome: "Ana" }], [{ key: "nome", label: "Nome Completo" }]);
    const lines = csv.replace("\uFEFF", "").split("\r\n");
    expect(lines[0]).toBe("Nome Completo");
  });

  it("escapa valores que contêm ponto e vírgula entre aspas", () => {
    const csv = toCsv([{ obs: "Sim; confirmado" }]);
    expect(csv).toContain('"Sim; confirmado"');
  });

  it("escapa aspas duplas duplicando-as", () => {
    const csv = toCsv([{ obs: 'Ele disse "oi"' }]);
    expect(csv).toContain('"Ele disse ""oi"""');
  });

  it("trata null e undefined como célula vazia", () => {
    const csv = toCsv([{ a: null, b: undefined, c: "x" }]);
    const lines = csv.replace("\uFEFF", "").split("\r\n");
    expect(lines[1]).toBe(";;x");
  });

  it("formata datas no padrão pt-BR", () => {
    const csv = toCsv([{ data: new Date(2026, 0, 15) }]);
    const lines = csv.replace("\uFEFF", "").split("\r\n");
    expect(lines[1]).toBe("15/01/2026");
  });

  it("inclui BOM UTF-8 no início para acentuação correta no Excel", () => {
    const csv = toCsv([{ nome: "José" }]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
  });
});
