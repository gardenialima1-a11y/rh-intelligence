export type BradfordRiskLevel = "Crítico" | "Atenção" | "Normal";

export interface BradfordResult {
  totalDays: number;
  bradfordScore: number;
  riskLevel: BradfordRiskLevel;
}

/**
 * Bradford Factor (B = S² × D) — métrica clássica de gestão de absenteísmo
 * (Bradford University / CIPD). Penaliza mais fortemente padrões de faltas
 * curtas e frequentes do que um único afastamento longo com o mesmo total de
 * dias. Faixas de referência de mercado: <50 normal · 50-449 atenção · ≥450 crítico.
 */
export function calculateBradfordFactor(occurrences: number, totalHours: number): BradfordResult {
  const totalDays = totalHours / 8;
  const bradfordScore = Math.round(occurrences ** 2 * totalDays);
  const riskLevel: BradfordRiskLevel = bradfordScore >= 450 ? "Crítico" : bradfordScore >= 50 ? "Atenção" : "Normal";
  return { totalDays: Number(totalDays.toFixed(1)), bradfordScore, riskLevel };
}
