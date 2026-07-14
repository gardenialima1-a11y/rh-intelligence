export interface ParsedLikertValue {
  raw: number;
  scaleMax: number;
  score10: number;
}

const LIKERT_PATTERN = /^(\d+):\s*\d+\/(\d+)$/;

export function parseLikertValue(raw: string): ParsedLikertValue | null {
  const match = raw.trim().match(LIKERT_PATTERN);
  if (!match) return null;
  const value = Number(match[1]);
  const scaleMax = Number(match[2]);
  if (scaleMax !== 5 && scaleMax !== 10) return null;

  const score10 = scaleMax === 10 ? value : Math.round(((value - 1) / 4) * 10);
  return { raw: value, scaleMax, score10 };
}

/** Um cabeçalho de coluna "é uma pergunta de escala" se a maioria dos valores da amostra bater no padrão N: N/5 ou N: N/10. */
export function detectLikertColumns(rows: Record<string, string>[], excludeColumns: Set<string>): string[] {
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0]).filter((h) => !excludeColumns.has(h));
  const detected: string[] = [];

  for (const header of headers) {
    const sample = rows.map((r) => r[header]).filter((v) => v !== undefined && v !== null && v !== "");
    if (sample.length === 0) continue;
    const matches = sample.filter((v) => parseLikertValue(String(v)) !== null).length;
    if (matches / sample.length > 0.7) detected.push(header);
  }

  return detected;
}
