export type AttendanceStatus = "PRESENTE" | "FALTOU" | "FERIAS" | "FOLGA" | "DISPENSADO" | "LICENCA" | "CARGO_CONFIANCA" | "OUTRO";

export interface ClassifyAttendanceInput {
  rotinaEsperada: string;
  hasEntrada: boolean;
}

const KEYWORD_MAP: { keyword: string; status: AttendanceStatus }[] = [
  { keyword: "cargo de confiança", status: "CARGO_CONFIANCA" },
  { keyword: "férias", status: "FERIAS" },
  { keyword: "ferias", status: "FERIAS" },
  { keyword: "folga", status: "FOLGA" },
  { keyword: "dispensa", status: "DISPENSADO" },
  { keyword: "licença", status: "LICENCA" },
  { keyword: "licenca", status: "LICENCA" },
];

const TIME_PATTERN = /\d{1,2}:\d{2}/;

/**
 * Classifica o status de um colaborador num dia, a partir do texto da coluna
 * "Rotina Esperada" do relatório de ponto e se ele registrou entrada.
 * - Palavras-chave conhecidas (Férias, Folga, Dispensa, Licença, Cargo de
 *   Confiança) têm prioridade sobre qualquer outra coisa.
 * - Se o texto parece um horário (contém "07:00" etc.) e não teve entrada
 *   registrada, é falta. Se teve entrada, é presença.
 * - Texto desconhecido (não é horário, não é nenhuma palavra-chave) vira
 *   OUTRO — fica sinalizado pra revisão manual, nunca é contado como falta.
 */
export function classifyAttendanceRow(input: ClassifyAttendanceInput): AttendanceStatus {
  const text = input.rotinaEsperada.trim().toLowerCase();

  for (const { keyword, status } of KEYWORD_MAP) {
    if (text.includes(keyword)) return status;
  }

  if (TIME_PATTERN.test(text)) {
    return input.hasEntrada ? "PRESENTE" : "FALTOU";
  }

  return "OUTRO";
}
