/**
 * Validação e parsing da planilha de folha/ponto usada para importar horas
 * extras automaticamente (módulo Jornada). O layout de export varia de
 * empresa pra empresa, então o parser é tolerante: reconhece várias
 * variações de nome de coluna (com/sem acento, maiúsc/minúsc) e aceita
 * horas tanto no formato "HH:MM" quanto decimal ("7,5" ou "7.5").
 */

/** Remove acentos, baixa a caixa e tira espaços nas pontas — usado para casar nomes de coluna. */
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

/** Procura o valor da primeira coluna, dentre várias candidatas, que existir na planilha. */
export function getField(
  row: Record<string, string>,
  headerMap: Map<string, string>,
  candidates: string[]
): string {
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

/** Aceita "07:30" (HH:MM), "7,5" ou "7.5" (decimal) e devolve horas em decimal. Retorna null se vazio/inválido. */
export function parseHours(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const text = raw.toString().trim();
  if (!text) return null;

  const timeMatch = text.match(/^(-?)(\d{1,3}):(\d{2})$/);
  if (timeMatch) {
    const [, sign, h, m] = timeMatch;
    const value = Number(h) + Number(m) / 60;
    return sign === "-" ? -value : Math.round(value * 100) / 100;
  }

  const numeric = Number(text.replace(/\./g, "").replace(",", "."));
  if (!Number.isNaN(numeric) && text.includes(",")) return numeric;

  const numericPlain = Number(text.replace(",", "."));
  return Number.isNaN(numericPlain) ? null : numericPlain;
}

/** Aceita "R$ 1.234,56", "1234,56" ou "1234.56" e devolve um número. */
export function parseCurrency(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const text = raw.toString().trim().replace(/^R\$\s*/i, "");
  if (!text) return null;
  const cleaned = text.replace(/\./g, "").replace(",", ".");
  const value = Number(cleaned);
  return Number.isNaN(value) ? null : value;
}

/** Aceita "14/07/26", "14/07/2026" ou "2026-07-14" e devolve um Date (meia-noite). */
export function parseFolhaDate(raw: string | undefined | null): Date | null {
  if (!raw) return null;
  const text = raw.toString().trim();

  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (br) {
    const [, d, m, yRaw] = br;
    const y = yRaw.length === 2 ? 2000 + Number(yRaw) : Number(yRaw);
    const date = new Date(y, Number(m) - 1, Number(d));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

export const REGISTRATION_HEADERS = ["Código", "Codigo", "Matrícula", "Matricula", "Cód. Func.", "Cod Func", "Cod. Funcionário"];
export const NAME_HEADERS = ["Nome", "Colaborador", "Funcionário", "Funcionario"];
export const DATE_HEADERS = ["Dia", "Data", "Data Referência", "Data Referencia"];
export const SCHEDULED_HEADERS = ["Rotina Esperada", "Carga Horária", "Carga Horaria", "Horas Previstas", "Horário Previsto", "Horario Previsto"];
export const WORKED_HEADERS = ["Horas Trabalhadas", "Total Trabalhado", "Trabalhado", "Horas Trabalhado"];
export const OVERTIME_HEADERS = ["Horas Extras", "Hora Extra", "HE", "Horas Extra"];
export const OVERTIME_50_HEADERS = ["HE 50%", "He 50", "Extra 50%", "Hora Extra 50%"];
export const OVERTIME_100_HEADERS = ["HE 100%", "He 100", "Extra 100%", "Hora Extra 100%"];
export const OVERTIME_VALUE_HEADERS = ["Valor Extra", "Valor HE", "Valor Hora Extra", "Custo HE", "Valor das Horas Extras"];
