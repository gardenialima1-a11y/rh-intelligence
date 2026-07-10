export type VacancyStatus = "ABERTA" | "EM_ANDAMENTO" | "PREENCHIDA" | "CANCELADA" | "EM_PAUSA";

export interface VacancySlaInput {
  status: VacancyStatus;
  openedAt: Date;
  closedAt: Date | null;
  targetDays: number;
}

export interface VacancySlaResult {
  daysElapsed: number;
  isBreached: boolean;
  isOpen: boolean;
}

const OPEN_STATUSES: VacancyStatus[] = ["ABERTA", "EM_ANDAMENTO", "EM_PAUSA"];

/**
 * Calcula o SLA de uma vaga: para vagas ainda abertas, conta os dias desde a
 * abertura até hoje; para vagas preenchidas, conta até a data de fechamento.
 * Vagas canceladas não são consideradas "estouradas" (não fazia sentido
 * cobrar prazo de uma vaga que foi cancelada, não perdida por demora).
 */
export function calculateVacancySla(vacancy: VacancySlaInput, now: Date = new Date()): VacancySlaResult {
  const isOpen = OPEN_STATUSES.includes(vacancy.status);
  const endDate = isOpen ? now : (vacancy.closedAt ?? now);
  const daysElapsed = Math.max(0, Math.floor((endDate.getTime() - vacancy.openedAt.getTime()) / 86400000));
  const isBreached = vacancy.status !== "CANCELADA" && daysElapsed > vacancy.targetDays;

  return { daysElapsed, isBreached, isOpen };
}
