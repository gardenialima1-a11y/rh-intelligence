"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

export function TrendChart({
  data,
  labels,
  color = "#1B2A4A",
  valueFormatter,
}: {
  data: number[];
  labels: string[];
  color?: string;
  valueFormatter?: (v: number) => string;
}) {
  const chartData = data.map((v, i) => ({ name: labels[i], value: v }));
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={((v: number) => (valueFormatter ? valueFormatter(v) : v)) as any}
          cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
          contentStyle={{
            borderRadius: 10,
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-md)",
            fontSize: 12,
            padding: "8px 12px",
          }}
          labelStyle={{ fontWeight: 600, marginBottom: 2, color: "var(--foreground)" }}
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
