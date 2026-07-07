/**
 * Converte um array de objetos em uma string CSV (RFC 4180), com escaping
 * correto de vírgulas, aspas e quebras de linha. Usa ';' como separador
 * (padrão do Excel em configurações regionais pt-BR) e BOM UTF-8 para
 * garantir acentuação correta ao abrir no Excel.
 */
export function toCsv(rows: Record<string, unknown>[], columns?: { key: string; label: string }[]): string {
  if (rows.length === 0) return "";

  const cols = columns ?? Object.keys(rows[0]).map((key) => ({ key, label: key }));

  function escapeCell(value: unknown): string {
    if (value === null || value === undefined) return "";
    const str = value instanceof Date ? value.toLocaleDateString("pt-BR") : String(value);
    if (str.includes(";") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  const header = cols.map((c) => escapeCell(c.label)).join(";");
  const lines = rows.map((row) => cols.map((c) => escapeCell(row[c.key])).join(";"));

  return "\uFEFF" + [header, ...lines].join("\r\n");
}
