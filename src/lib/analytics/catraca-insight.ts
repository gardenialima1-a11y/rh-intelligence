import type { HistoricoResult } from "@/services/catraca-historico";

export interface AttentionPoint {
  severity: "danger" | "warning" | "info";
  text: string;
}

interface CatracaInsightInput {
  criticalEmployees: number;
  ranking: { name: string; value: number }[];
  byUnit: { name: string; value: number }[];
  historico: HistoricoResult;
}

/**
 * Monta os "pontos de atenção" da aba Executiva do módulo de Catraca, a
 * partir dos dados que a página já buscou (não faz nenhuma consulta nova).
 * Cada ponto é independente — só entra na lista se fizer sentido pro
 * período (ex.: não mostra "colaboradores críticos" se não tiver nenhum).
 */
export function buildCatracaAttentionPoints({ criticalEmployees, ranking, byUnit, historico }: CatracaInsightInput): AttentionPoint[] {
  const points: AttentionPoint[] = [];

  if (criticalEmployees > 0) {
    points.push({
      severity: "danger",
      text: `${criticalEmployees} colaborador${criticalEmployees === 1 ? "" : "es"} em situação crítica — mais de 2h fora do posto no período.`,
    });
  }

  const top = ranking[0];
  if (top && top.value > 0) {
    const horas = Math.floor(top.value / 60);
    const min = top.value % 60;
    const tempo = horas > 0 ? `${horas}h${min > 0 ? ` ${min}min` : ""}` : `${min}min`;
    points.push({
      severity: "warning",
      text: `Maior tempo fora do posto no período: ${top.name}, com ${tempo}.`,
    });
  }

  const piorou = historico.rows.filter((r) => r.trend === "up").length;
  if (piorou > 0) {
    points.push({
      severity: "warning",
      text:
        piorou === 1
          ? "1 colaborador piorou o tempo fora do posto entre o início e o fim do período."
          : `${piorou} colaboradores pioraram o tempo fora do posto entre o início e o fim do período.`,
    });
  }

  const melhorou = historico.rows.filter((r) => r.trend === "down").length;
  if (melhorou > 0) {
    points.push({
      severity: "info",
      text:
        melhorou === 1
          ? "1 colaborador melhorou o tempo fora do posto no mesmo comparativo."
          : `${melhorou} colaboradores melhoraram o tempo fora do posto no mesmo comparativo.`,
    });
  }

  const topUnit = [...byUnit].sort((a, b) => b.value - a.value)[0];
  if (topUnit && topUnit.value > 0 && byUnit.length > 1) {
    points.push({
      severity: "info",
      text: `Unidade com maior tempo acumulado fora do posto: ${topUnit.name}.`,
    });
  }

  if (points.length === 0) {
    points.push({ severity: "info", text: "Sem ocorrências relevantes no período — nenhum ponto de atenção identificado." });
  }

  return points;
}
