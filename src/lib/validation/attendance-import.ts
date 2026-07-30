export type AttendanceStatus =
  | "PRESENTE"
  | "FALTOU"
  | "FERIAS"
  | "FOLGA"
  | "FERIADO"
  | "SEM_JORNADA"
  | "DISPENSADO"
  | "LICENCA"
  | "ATESTADO"
  | "DECLARACAO"
  | "ABONO"
  | "CURSO_APRENDIZAGEM"
  | "CARGO_CONFIANCA"
  | "OUTRO";

export interface ClassifyAttendanceInput {
  rotinaEsperada: string;
  /**
   * Coluna "Obs" do relatório de ponto. IMPORTANTE: "Rotina Esperada" é sempre a
   * jornada normal do colaborador (o que ele deveria fazer naquele dia da semana);
   * é a coluna Obs que registra o que realmente aconteceu (atestado, declaração,
   * abono, curso etc.) quando o dia foge do normal. Por isso as duas colunas
   * precisam ser checadas juntas — olhar só a Rotina Esperada faz todo dia sem
   * batida de ponto virar "falta injustificada", mesmo tendo atestado.
   */
  obs: string;
  hasEntrada: boolean;
}

/**
 * Palavras-chave e o status que cada uma indica. A ORDEM importa: a primeira
 * palavra-chave que bater no texto (Rotina Esperada + Obs, combinados) decide o
 * status do dia. Motivos que descrevem o dia inteiro (férias, folga, feriado,
 * cargo de confiança, sem jornada) vêm antes dos motivos que são uma observação
 * pontual (atestado, declaração, abono, curso), pra evitar ambiguidade.
 */
const KEYWORD_MAP: { keyword: string; status: AttendanceStatus }[] = [
  { keyword: "cargo de confiança", status: "CARGO_CONFIANCA" },
  { keyword: "cargo de confianca", status: "CARGO_CONFIANCA" },
  { keyword: "férias", status: "FERIAS" },
  { keyword: "ferias", status: "FERIAS" },
  { keyword: "feriado", status: "FERIADO" },
  { keyword: "folga", status: "FOLGA" }, // cobre "Folga" e "Folga*"
  { keyword: "sem jornada", status: "SEM_JORNADA" },
  { keyword: "sem escala", status: "SEM_JORNADA" },
  { keyword: "curso", status: "CURSO_APRENDIZAGEM" },
  { keyword: "aprendizagem", status: "CURSO_APRENDIZAGEM" },
  { keyword: "abono", status: "ABONO" },
  { keyword: "dispensa", status: "DISPENSADO" },
  { keyword: "licença", status: "LICENCA" },
  { keyword: "licenca", status: "LICENCA" },
  { keyword: "atestado", status: "ATESTADO" },
  { keyword: "declaração", status: "DECLARACAO" },
  { keyword: "declaracao", status: "DECLARACAO" },
];

const TIME_PATTERN = /\d{1,2}:\d{2}/;

/**
 * Classifica o status de um colaborador num dia, a partir da Rotina Esperada +
 * Obs combinadas e de se ele registrou entrada.
 * - Palavras-chave conhecidas têm prioridade sobre qualquer outra coisa, não
 *   importa em qual das duas colunas apareceram.
 * - Se não bateu nenhuma palavra-chave e o texto parece um horário (contém
 *   "07:00" etc.) e não teve entrada registrada, é falta de verdade (sem
 *   justificativa encontrada). Se teve entrada, é presença.
 * - Texto desconhecido (não é horário, não é nenhuma palavra-chave) vira
 *   OUTRO — fica sinalizado pra revisão manual, nunca é contado como falta.
 */
export function classifyAttendanceRow(input: ClassifyAttendanceInput): AttendanceStatus {
  const combined = `${input.rotinaEsperada} ${input.obs}`.trim().toLowerCase();

  for (const { keyword, status } of KEYWORD_MAP) {
    if (combined.includes(keyword)) return status;
  }

  const rotina = input.rotinaEsperada.trim().toLowerCase();
  if (TIME_PATTERN.test(rotina)) {
    return input.hasEntrada ? "PRESENTE" : "FALTOU";
  }

  return "OUTRO";
}
