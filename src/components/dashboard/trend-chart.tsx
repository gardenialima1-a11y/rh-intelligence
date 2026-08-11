"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatChartValue, type ChartFormat } from "@/lib/chart-formatters";

interface TrendTooltipPayloadRow {
  name: string;
  value: number;
  secondary?: number;
}

function TrendChartTooltip({
  active,
  payload,
  format,
  primaryLabel,
  secondaryLabel,
  secondaryFormat,
}: {
  active?: boolean;
  payload?: { payload: TrendTooltipPayloadRow }[];
  format?: ChartFormat;
  primaryLabel?: string;
  secondaryLabel?: string;
  secondaryFormat?: ChartFormat;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0].payload;

  return (
    <div
      style={{
        borderRadius: 10,
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-md)",
        fontSize: 12,
        padding: "8px 12px",
        background: "var(--card)",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 2, color: "var(--foreground)" }}>{row.name}</div>
      <div style={{ color: "var(--foreground)" }}>
        {primaryLabel ? `${primaryLabel}: ` : ""}
        {formatChartValue(row.value, format)}
      </div>
      {secondaryLabel && row.secondary != null && (
        <div style={{ color: "var(--muted-foreground)", marginTop: 2 }}>
          {secondaryLabel}: {formatChartValue(row.secondary, secondaryFormat)}
        </div>
      )}
    </div>
  );
}

export function TrendChart({
  data,
  labels,
  color = "#1B2A4A",
  format,
  primaryLabel,
  secondaryData,
  secondaryLabel,
  secondaryFormat,
}: {
  data: number[];
  labels: string[];
  color?: string;
  format?: ChartFormat;
  /** Nome da série principal, mostrado no tooltip antes do valor (ex.: "Horas extras"). Opcional — sem isso, o tooltip só mostra o valor puro, como já era antes. */
  primaryLabel?: string;
  /** Segunda informação, na mesma posição do mês, mostrada como uma linha extra no tooltip (ex.: custo de horas extras). Não desenha uma segunda linha no gráfico — só aparece ao passar o mouse. */
  secondaryData?: number[];
  secondaryLabel?: string;
  secondaryFormat?: ChartFormat;
}) {
  const chartData = data.map((v, i) => ({ name: labels[i], value: v, secondary: secondaryData?.[i] }));
  const gradientId = `trendFill-${color.replace("#", "")}`;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={chartData} margin={{ top: 10, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="0" stroke="var(--border)" strokeOpacity={0.6} vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          tickMargin={10}
        />
        <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={40} />
        <Tooltip
          cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
          content={
            <TrendChartTooltip
              format={format}
              primaryLabel={primaryLabel}
              secondaryLabel={secondaryLabel}
              secondaryFormat={secondaryFormat}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2.5}
          fill={`url(#${gradientId})`}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
