"use client";

import { useId } from "react";
import { AreaChart, Area, ResponsiveContainer, YAxis } from "recharts";

const ACCENT_COLOR: Record<string, string> = {
  navy: "#1B2A4A",
  gold: "#B8935A",
  success: "#4C8B5B",
  danger: "#B23A48",
};

export function Sparkline({ data, accent = "navy" }: { data: number[]; accent?: string }) {
  const chartData = data.map((v, i) => ({ i, v }));
  const color = ACCENT_COLOR[accent] ?? ACCENT_COLOR.navy;
  const gradientId = `spark-${useId().replace(/:/g, "")}`;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${gradientId})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
