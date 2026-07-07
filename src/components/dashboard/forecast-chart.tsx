"use client";

import { ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

interface ForecastChartProps {
  historicalData: number[];
  historicalLabels: string[];
  forecastData: number[];
  forecastLabels: string[];
  color?: string;
  valueFormatter?: (v: number) => string;
}

export function ForecastChart({
  historicalData,
  historicalLabels,
  forecastData,
  forecastLabels,
  color = "#1B2A4A",
  valueFormatter,
}: ForecastChartProps) {
  // Uma única série "historical" (sólida) e uma série "forecast" (tracejada) que
  // começa exatamente no último ponto histórico, para a linha aparecer contínua.
  const chartData = [
    ...historicalData.map((v, i) => ({ name: historicalLabels[i], historical: v, forecast: null as number | null })),
    ...forecastData.map((v, i) => ({ name: forecastLabels[i], historical: null as number | null, forecast: v })),
  ];
  if (historicalData.length > 0 && forecastData.length > 0) {
    chartData[historicalData.length - 1].forecast = historicalData[historicalData.length - 1];
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="0" stroke="var(--border)" strokeOpacity={0.6} vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickMargin={8} />
        <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={40} />
        <Tooltip
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={((v: number) => (valueFormatter ? valueFormatter(v) : v)) as any}
          contentStyle={{
            borderRadius: 10,
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-md)",
            fontSize: 12,
            padding: "8px 12px",
          }}
          labelStyle={{ fontWeight: 600, marginBottom: 2, color: "var(--foreground)" }}
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="plainline" />
        <Line
          type="monotone"
          dataKey="historical"
          name="Realizado"
          stroke={color}
          strokeWidth={2.5}
          dot={false}
          connectNulls={false}
        />
        <Line
          type="monotone"
          dataKey="forecast"
          name="Projeção"
          stroke={color}
          strokeWidth={2}
          strokeDasharray="5 4"
          dot={{ r: 2.5 }}
          connectNulls
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
