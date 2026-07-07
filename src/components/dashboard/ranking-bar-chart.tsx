"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const PALETTE = ["#1B2A4A", "#2C4270", "#B8935A", "#4C8B5B", "#5A5F6B", "#C9922E", "#B23A48"];

export function RankingBarChart({
  data,
  dataKey = "value",
  color,
  horizontal = true,
}: {
  data: Record<string, string | number>[];
  dataKey?: string;
  color?: string;
  horizontal?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 34)}>
      <BarChart
        data={data}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ top: 6, right: 24, bottom: 0, left: 4 }}
        barCategoryGap={horizontal ? 10 : 16}
      >
        <CartesianGrid strokeDasharray="0" stroke="var(--border)" strokeOpacity={0.6} horizontal={!horizontal} vertical={horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              width={140}
              tick={{ fontSize: 11.5, fill: "var(--foreground)" }}
              axisLine={false}
              tickLine={false}
            />
          </>
        ) : (
          <>
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickMargin={8} />
            <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
          </>
        )}
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.4 }}
          contentStyle={{
            borderRadius: 10,
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-md)",
            fontSize: 12,
            padding: "8px 12px",
          }}
          labelStyle={{ fontWeight: 600, marginBottom: 2, color: "var(--foreground)" }}
        />
        <Bar dataKey={dataKey} radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]} maxBarSize={horizontal ? 20 : 44}>
          {data.map((_, i) => (
            <Cell key={i} fill={color ?? PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
