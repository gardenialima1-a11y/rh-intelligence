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
