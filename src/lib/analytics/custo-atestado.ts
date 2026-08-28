/**
 * Lógica pura (sem banco) para o cruzamento "Ponto x Folha de Pagamento" do
 * módulo de Absenteísmo:
 *
 * 1) Custo real de cada atestado médico — em vez de estimar o valor-hora
 *    pela faixa salarial do cargo, usa o salário real lançado na folha
 *    daquele colaborador naquele mês, quando disponível (mais preciso,
 *    porque cruza com o que a empresa realmente pagou).
 *
 * 2) Falta injustificada x desconto na folha — uma falta (status FALTOU no
 *    ponto) só é contada como "falta injustificada confirmada" se existir um
 *    desconto correspondente na folha daquele colaborador naquele mês. Se a
 *    folha detalhada daquele mês foi importada mas não tem desconto de falta
 *    para aquele colaborador, a falta é tratada como "abonada" (pode ter sido
 *    negociada com o gestor, dispensada, etc. — não vira custo/penalização).
 *    Se não houver folha detalhada nenhuma para aquele colaborador/mês, não
 *    dá pra afirmar nada: fica "indeterminada", separada do resto, em vez de
 *    ser contada ou descartada por suposição.
 */

// Jornada mensal padrão usada para transformar salário em valor-hora (CLT: 220h/mês).
export const MONTHLY_HOURS_CLT = 220;

export type TaxaHorariaFonte = "FOLHA_REAL" | "FAIXA_CARGO" | "MEDIA_FAIXAS";

export interface ResolveHourlyRateInput {
  /** Salário base real do colaborador, lançado na folha daquele mês (PayrollEntry.baseSalary). */
  realMonthlySalary?: number | null;
  positionFloor?: number | null;
  positionCeil?: number | null;
  /** Média salarial dos cargos com faixa cadastrada, usada só quando não há salário real nem faixa do cargo. */
  fallbackMonthlySalary: number;
}

export interface ResolvedHourlyRate {
  rate: number;
  source: TaxaHorariaFonte;
}

/**
 * Escolhe a melhor fonte disponível pra converter salário mensal em valor-hora:
 * 1º) salário real da folha daquele mês (o mais preciso — é o que a empresa
 *     de fato pagou); 2º) faixa salarial do cargo (piso/teto); 3º) média das
 *     faixas cadastradas, só como último recurso.
 */
export function resolveHourlyRate(
  input: ResolveHourlyRateInput,
  monthlyHours: number = MONTHLY_HOURS_CLT
): ResolvedHourlyRate {
  if (input.realMonthlySalary != null && input.realMonthlySalary > 0) {
    return { rate: input.realMonthlySalary / monthlyHours, source: "FOLHA_REAL" };
  }
  if (input.positionFloor != null && input.positionFloor > 0) {
    const monthlySalary = (input.positionFloor + (input.positionCeil ?? input.positionFloor)) / 2;
    return { rate: monthlySalary / monthlyHours, source: "FAIXA_CARGO" };
  }
  return { rate: (input.fallbackMonthlySalary ?? 0) / monthlyHours, source: "MEDIA_FAIXAS" };
}

/**
 * Termos usados nos relatórios de folha (verba/descrição) para descontos
 * ligados a falta. Casa por substring, sem acento nem caixa — cobre variações
 * comuns como "FALTA", "FALTAS INJUSTIFICADAS", "DSR S/FALTA", "DESC. FALTA",
 * "AUSÊNCIA"/"AUSENCIA". Mantido como lista simples (e não um enum fechado)
 * porque a redação exata varia de empresa pra empresa no PDF da folha — mesmo
 * espírito da checagem de PERICULOSIDADE/INSALUBRIDADE em custos-detalhado.ts.
 */
const FALTA_DEDUCTION_PATTERNS = [/FALTA/i, /AUS[EÊ]NCIA/i];

export interface PayrollDescontoItem {
  descricao: string;
  valor: number;
}

export interface FaltaDeductionMatch {
  matched: boolean;
  totalValor: number;
  items: PayrollDescontoItem[];
}

/** Verifica se algum desconto da folha daquele colaborador/mês corresponde a uma falta. */
export function matchFaltaDeduction(descontos: PayrollDescontoItem[]): FaltaDeductionMatch {
  const items = descontos.filter((d) => FALTA_DEDUCTION_PATTERNS.some((re) => re.test(d.descricao)));
  return {
    matched: items.length > 0,
    totalValor: items.reduce((s, i) => s + i.valor, 0),
    items,
  };
}

export type FaltaCruzamentoStatus = "CONFIRMADA" | "ABONADA" | "INDETERMINADA";

/**
 * Classifica uma falta (status FALTOU no ponto) cruzando com a folha:
 * - Sem folha detalhada (por verba) daquele colaborador naquele mês: não dá
 *   pra provar nem descartar — INDETERMINADA.
 * - Com folha detalhada e desconto de falta encontrado: CONFIRMADA (é custo
 *   real de falta injustificada).
 * - Com folha detalhada e SEM desconto de falta: ABONADA — pode ter sido
 *   negociada com o gestor (banco de horas, compensação, dispensa) e por
 *   isso não vira desconto; não deve contar como falta injustificada.
 */
export function classifyFaltaCruzamento(
  hasPayrollDetailForMonth: boolean,
  deductionMatch: Pick<FaltaDeductionMatch, "matched">
): FaltaCruzamentoStatus {
  if (!hasPayrollDetailForMonth) return "INDETERMINADA";
  return deductionMatch.matched ? "CONFIRMADA" : "ABONADA";
}
