/**
 * Parsing para a importação de "Listagem geral" de desligamentos: Nome,
 * Data de admissão, Função, Data de demissão, Motivo do desligamento.
 * Aceita cabeçalhos com pequenas variações de escrita/acento.
 */

function normalizeHeader(h: string): string {
  return h.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

export function buildHeaderMap(row: Record<string, string>): Map<string, string> {
  const map = new Map<string, string>();
  for (const key of Object.keys(row)) map.set(normalizeHeader(key), key);
  return map;
}

export function getField(row: Record<string, string>, headerMap: Map<string, string>, candidates: string[]): string {
  for (const c of candidates) {
    const key = headerMap.get(normalizeHeader(c));
    if (key !== undefined) {
      const v = row[key];
      if (v !== undefined && v !== null && v.toString().trim() !== "") return v.toString().trim();
    }
  }
  return "";
}

/** Aceita "14/07/2026", "14/07/26" ou "2026-07-14". */
export function parseHistoryDate(raw: string | undefined | null): Date | null {
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

export function normalizeName(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase().replace(/\s+/g, " ");
}

/**
 * A planilha não tem coluna de motivo "voluntário/involuntário" — só o texto
 * do motivo (ex.: "40 - Dispensa a Pedido (Espontaneo)"). Isso classifica
 * por palavra-chave. É uma aproximação: pode ajustar registro a registro
 * depois, direto na tela do módulo de Desligamentos.
 */
export function classifyVoluntary(motivo: string): boolean {
  const normalized = motivo.toUpperCase();
  return normalized.includes("PEDIDO") || normalized.includes("ESPONTANE");
}

export const NAME_HEADERS = ["Nome", "Colaborador", "Funcionario"];
export const ADMISSION_HEADERS = ["Dt. Admissao", "Data Admissao", "Admissao", "Dt Admissao"];
export const ROLE_HEADERS = ["Funcao", "Cargo"];
export const TERMINATION_HEADERS = ["Dt. Demissao", "Data Demissao", "Demissao", "Dt Demissao"];
export const REASON_HEADERS = ["Motivo do Desligamento", "Motivo Desligamento", "Motivo"];

/** Gera um código estável (mesma pessoa = sempre o mesmo código) pra servir de matrícula sintética. */
export function syntheticRegistration(normalizedName: string): string {
  let hash = 0;
  for (let i = 0; i < normalizedName.length; i++) {
    hash = (hash * 31 + normalizedName.charCodeAt(i)) >>> 0;
  }
  return "HIST-" + hash.toString(16).toUpperCase().padStart(8, "0");
}
