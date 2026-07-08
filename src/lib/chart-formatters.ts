export type ChartFormat = "currency" | "percent1";

export function formatChartValue(v: number, format?: ChartFormat): string | number {
  if (format === "currency") {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
  }
  if (format === "percent1") {
    return `${v.toFixed(1)}%`;
  }
  return v;
}
