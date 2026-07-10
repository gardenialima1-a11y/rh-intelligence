export interface TurnstileImportRow {
  matricula: string;
  dataHora: string;
  direcao: string;
  local: string;
}

export interface NormalizedTurnstileEvent {
  employeeId: string;
  timestamp: Date;
  direction: "ENTRADA" | "SAIDA";
  location: string | null;
}

export interface TurnstileRowResult {
  rowNumber: number;
  data: NormalizedTurnstileEvent | null;
  errors: string[];
}

const DIRECTION_MAP: Record<string, "ENTRADA" | "SAIDA"> = {
  entrada: "ENTRADA",
  e: "ENTRADA",
  in: "ENTRADA",
  saida: "SAIDA",
  "saída": "SAIDA",
  s: "SAIDA",
  out: "SAIDA",
};

function norm(s: string | undefined | null): string {
  return (s ?? "").trim();
}

/** Aceita "dd/mm/aaaa hh:mm[:ss]" ou "aaaa-mm-ddThh:mm[:ss]" e devolve um Date válido, ou null. */
function parseDateTime(raw: string): Date | null {
  const value = raw.trim();
  if (!value) return null;

  const br = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (br) {
    const [, d, m, y, hh, mm, ss] = br;
    const date = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss ?? 0));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (iso) {
    const [, y, m, d, hh, mm, ss] = iso;
    const date = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss ?? 0));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

/**
 * Valida e normaliza uma linha do relatório de catraca. Recebe o mapa de
 * matrícula → id do colaborador (já carregado do banco) para resolver o
 * vínculo — nunca faz consulta ao banco aqui dentro (função pura, testável).
 */
export function validateTurnstileImportRow(
  row: TurnstileImportRow,
  rowNumber: number,
  employeeIdByRegistration: Map<string, string>
): TurnstileRowResult {
  const errors: string[] = [];

  const registration = norm(row.matricula);
  const employeeId = registration ? employeeIdByRegistration.get(registration) : undefined;
  if (!registration) errors.push("Matrícula é obrigatória");
  else if (!employeeId) errors.push(`Matrícula "${registration}" não encontrada no cadastro de colaboradores`);

  const timestamp = parseDateTime(row.dataHora);
  if (!norm(row.dataHora)) errors.push("Data e hora são obrigatórias");
  else if (!timestamp) errors.push(`Data e hora "${row.dataHora}" em formato inválido (use dd/mm/aaaa hh:mm)`);

  const directionRaw = norm(row.direcao).toLowerCase();
  const direction = DIRECTION_MAP[directionRaw];
  if (!directionRaw) errors.push("Direção (Entrada/Saída) é obrigatória");
  else if (!direction) errors.push(`Direção "${row.direcao}" não reconhecida (use Entrada ou Saída)`);

  if (errors.length > 0) return { rowNumber, data: null, errors };

  return {
    rowNumber,
    errors: [],
    data: {
      employeeId: employeeId!,
      timestamp: timestamp!,
      direction: direction!,
      location: norm(row.local) || null,
    },
  };
}
