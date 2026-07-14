export interface InssLeaveDurationInput {
  startDate: Date;
  actualReturnDate: Date | null;
}

export interface InssLeaveDurationResult {
  daysAway: number;
  isOngoing: boolean;
}

/**
 * Calcula os dias afastados: se ainda não retornou, conta até hoje; se já
 * retornou, conta até a data de retorno real (fixo, não continua contando).
 */
export function calculateInssLeaveDuration(input: InssLeaveDurationInput, now: Date = new Date()): InssLeaveDurationResult {
  const isOngoing = input.actualReturnDate === null;
  const endDate = isOngoing ? now : input.actualReturnDate!;
  const daysAway = Math.max(0, Math.floor((endDate.getTime() - input.startDate.getTime()) / 86400000));
  return { daysAway, isOngoing };
}
