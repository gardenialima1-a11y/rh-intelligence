/**
 * Parser para o relatório real de marcações da catraca (formato exportado
 * pelo sistema de controle de acesso): organizado em blocos por funcionário
 * ("Usuário: NOME"), com linhas de data/hora e tipo (ex.: "Entrada - Cartão")
 * dentro de cada bloco — não é uma planilha "linha por linha" tradicional.
 */

export interface ParsedTurnstileEntry {
  employeeName: string;
  timestamp: Date;
  direction: "ENTRADA" | "SAIDA";
  rowNumber: number;
}

export interface ParseReportResult {
  entries: ParsedTurnstileEntry[];
  warnings: string[];
}

const DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

function parseDateTime(raw: string): Date | null {
  const match = raw.trim().match(DATE_PATTERN);
  if (!match) return null;
  const [, d, m, y, hh, mm, ss] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss ?? 0));
  return Number.isNaN(date.getTime()) ? null : date;
}

function detectDirection(cells: string[]): "ENTRADA" | "SAIDA" | null {
  const joined = cells.join(" ").toLowerCase();
  if (joined.includes("entrada")) return "ENTRADA";
  if (joined.includes("saida") || joined.includes("saída")) return "SAIDA";
  return null;
}

/**
 * Varre as linhas cruas do relatório (array de arrays, sem cabeçalho único)
 * e extrai os eventos de catraca, associando cada um ao funcionário do bloco
 * em que aparece. Função pura — não acessa banco, não conhece IDs de
 * colaborador — só entende a estrutura do arquivo.
 */
export function parseTurnstileReport(rows: string[][]): ParseReportResult {
  const entries: ParsedTurnstileEntry[] = [];
  const warnings: string[] = [];
  let currentEmployeeName: string | null = null;

  rows.forEach((cells, index) => {
    const rowNumber = index + 1;
    const firstCell = (cells[0] ?? "").trim();

    if (firstCell === "Usuário:" || firstCell.toLowerCase() === "usuário:" || firstCell.toLowerCase() === "usuario:") {
      currentEmployeeName = (cells[1] ?? "").trim();
      return;
    }

    if (firstCell === "Cartão:" || firstCell === "Data/Hora") {
      return;
    }

    const timestamp = parseDateTime(firstCell);
    if (!timestamp) return;

    if (!currentEmployeeName) {
      warnings.push(`Linha ${rowNumber}: data encontrada antes de qualquer "Usuário:" — ignorada.`);
      return;
    }

    const direction = detectDirection(cells);
    if (!direction) {
      warnings.push(`Linha ${rowNumber} (${currentEmployeeName}): não reconheci Entrada/Saída em "${cells.join(" | ")}".`);
      return;
    }

    entries.push({ employeeName: currentEmployeeName, timestamp, direction, rowNumber });
  });

  return { entries, warnings };
}

export interface MatchedTurnstileEvent {
  employeeId: string;
  timestamp: Date;
  direction: "ENTRADA" | "SAIDA";
}

export interface MatchResult {
  matched: MatchedTurnstileEvent[];
  unmatchedNames: string[];
}

/** Casa os nomes extraídos do relatório com os colaboradores cadastrados (comparação sem acento/maiúsculas). */
function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

export function matchEntriesToEmployees(
  entries: ParsedTurnstileEntry[],
  employees: { id: string; name: string }[]
): MatchResult {
  const byName = new Map(employees.map((e) => [normalizeName(e.name), e.id]));
  const matched: MatchedTurnstileEvent[] = [];
  const unmatchedSet = new Set<string>();

  for (const entry of entries) {
    const employeeId = byName.get(normalizeName(entry.employeeName));
    if (!employeeId) {
      unmatchedSet.add(entry.employeeName);
      continue;
    }
    matched.push({ employeeId, timestamp: entry.timestamp, direction: entry.direction });
  }

  return { matched, unmatchedNames: Array.from(unmatchedSet) };
}
