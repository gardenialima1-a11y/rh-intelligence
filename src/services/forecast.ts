/**
 * Regressão linear simples (mínimos quadrados) para projeção de tendências.
 * Usada para estender séries históricas (headcount, turnover, etc.) com
 * pontos de forecast para os próximos N períodos.
 */
export function linearForecast(historicalValues: number[], periodsAhead: number): number[] {
  const n = historicalValues.length;
  if (n < 2) return Array(periodsAhead).fill(historicalValues[0] ?? 0);

  const xMean = (n - 1) / 2;
  const yMean = historicalValues.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (historicalValues[i] - yMean);
    denominator += (i - xMean) ** 2;
  }
  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = yMean - slope * xMean;

  const forecast: number[] = [];
  for (let i = 0; i < periodsAhead; i++) {
    const x = n + i;
    forecast.push(Math.max(0, intercept + slope * x));
  }
  return forecast;
}

/**
 * Constrói os rótulos (mês/ano abreviado) para os próximos N meses a partir de hoje.
 */
export function nextMonthLabelsPtBR(periodsAhead: number): string[] {
  const fmt = new Intl.DateTimeFormat("pt-BR", { month: "short" });
  const labels: string[] = [];
  const now = new Date();
  for (let i = 1; i <= periodsAhead; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    labels.push(fmt.format(d).replace(".", ""));
  }
  return labels;
}

/** Classifica a tendência (crescente/estável/decrescente) a partir da inclinação relativa. */
export function trendDirection(historicalValues: number[]): "up" | "down" | "flat" {
  const n = historicalValues.length;
  if (n < 2) return "flat";
  const first = historicalValues[0];
  const last = historicalValues[n - 1];
  const avg = historicalValues.reduce((a, b) => a + b, 0) / n || 1;
  const relChange = (last - first) / avg;
  if (relChange > 0.08) return "up";
  if (relChange < -0.08) return "down";
  return "flat";
}
