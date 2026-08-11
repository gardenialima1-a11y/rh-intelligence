/**
 * Validação e parsing da planilha de folha de pagamento, usada para
 * atualizar o custo de pessoal (módulo Custos) mês a mês. O layout de
 * export varia de empresa pra empresa, então o parser é tolerante:
 * reconhece várias variações de nome de coluna (com/sem acento,
 * maiúsc/minúsc) e aceita valores em formato "R$ 1.234,56", "1234,56" ou
 * "1234.56".
 *
 * A planilha não precisa trazer o mês/competência linha a linha — quem
 * importa escolhe o mês de referência no diálogo, e todas as linhas do
 * arquivo são gravadas com essa competência (upsert: se já existir um
 * lançamento do colaborador naquele mês, ele é atualizado).
 */

function normalizeHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function buildHeaderMap(row: Record<string, string>): Map<string, string> {
  const map = new Map<string, string>();
  for (const key of Object.keys(row)) {
    map.set(normalizeHeader(key), key);
  }
  return map;
}

export function getField(row: Record<string, string>, headerMap: Map<string, string>, candidates: string[]): string {
  for (const candidate of candidates) {
    const key = headerMap.get(normalizeHeader(candidate));
    if (key !== undefined) {
      const value = row[key];
      if (value !== undefined && value !== null && value.toString().trim() !== "") {
        return value.toString().trim();
      }
    }
  }
  return "";
}

/** Aceita "R$ 1.234,56", "1234,56" ou "1234.56" e devolve um número. Retorna null se vazio/inválido. */
export function parseCurrency(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const text = raw.toString().trim().replace(/^R\$\s*/i, "");
  if (!text) return null;
  const cleaned = text.replace(/\./g, "").replace(",", ".");
  const value = Number(cleaned);
  return Number.isNaN(value) ? null : value;
}

export const REGISTRATION_HEADERS = ["Código", "Codigo", "Matrícula", "Matricula", "Cód. Func.", "Cod Func", "Cod. Funcionário"];
export const NAME_HEADERS = ["Nome", "Colaborador", "Funcionário", "Funcionario"];
export const BASE_SALARY_HEADERS = ["Salário Base", "Salario Base", "Salário", "Salario", "Salário Bruto", "Salario Bruto"];
export const BENEFITS_HEADERS = ["Benefícios", "Beneficios", "Custo Benefícios", "Custo Beneficios"];
export const CHARGES_HEADERS = ["Encargos", "Custo Encargos", "INSS/FGTS", "Encargos (INSS/FGTS)"];
export const TOTAL_COST_HEADERS = ["Custo Total", "Total", "Valor Total", "Custo Total Folha"];
