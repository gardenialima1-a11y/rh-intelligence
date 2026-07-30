export interface ProbationDates {
  checkpoint1: Date; // 30 dias após admissão (1ª avaliação)
  checkpoint2: Date; // 90 dias após admissão (30+60, avaliação final)
}

export function computeProbationDates(admissionDate: Date): ProbationDates {
  const checkpoint1 = new Date(admissionDate);
  checkpoint1.setDate(checkpoint1.getDate() + 30);
  const checkpoint2 = new Date(admissionDate);
  checkpoint2.setDate(checkpoint2.getDate() + 90);
  return { checkpoint1, checkpoint2 };
}

export type StoredProbationStatus = "EM_AVALIACAO" | "APROVADO" | "REPROVADO";
export type DisplayProbationStatus = "EM_AVALIACAO" | "APROVADO" | "REPROVADO" | "PRAZO_EXPIRADO_NAO_AVALIADO";

/**
 * Se o gestor já decidiu (Aprovado/Reprovado), mostra a decisão. Se ainda não
 * decidiu e o prazo do checkpoint já passou, sinaliza "prazo expirado — não
 * avaliado" (alerta de atenção). Se o prazo ainda não chegou, mostra "Em avaliação".
 */
export function resolveDisplayStatus(stored: StoredProbationStatus, checkpointDate: Date, now: Date = new Date()): DisplayProbationStatus {
  if (stored === "APROVADO" || stored === "REPROVADO") return stored;
  if (now.getTime() > checkpointDate.getTime()) return "PRAZO_EXPIRADO_NAO_AVALIADO";
  return "EM_AVALIACAO";
}

/** Ainda dentro do período de experiência hoje (não passou do checkpoint final)? */
export function isWithinProbationWindow(admissionDate: Date, now: Date = new Date(), windowDays = 90, gracePeriodDays = 15): boolean {
  const daysSinceAdmission = Math.floor((now.getTime() - admissionDate.getTime()) / 86400000);
  return daysSinceAdmission >= 0 && daysSinceAdmission <= windowDays + gracePeriodDays;
}

export interface ProbationAlertInfo {
  /** Dias até o checkpoint de 90 dias (negativo se já passou). */
  diasRestantes: number;
  /** true quando faltam 10 dias ou menos pro checkpoint de 90 dias e a avaliação final ainda não foi decidida. */
  alerta: boolean;
}

/**
 * Alerta de prazo: dispara quando faltam 10 dias ou menos pro fim do período
 * de experiência (checkpoint de 90 dias) e ainda não houve decisão
 * (Aprovado/Reprovado) registrada — pra dar tempo da liderança agendar a
 * avaliação final antes do prazo vencer.
 */
export function computeProbationAlert(checkpoint2: Date, status60: DisplayProbationStatus, now: Date = new Date()): ProbationAlertInfo {
  const diasRestantes = Math.ceil((checkpoint2.getTime() - now.getTime()) / 86400000);
  const alerta = diasRestantes >= 0 && diasRestantes <= 10 && status60 === "EM_AVALIACAO";
  return { diasRestantes, alerta };
}
