"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export function PyramidChart({ data }: { data: { label: string; masculino: number; feminino: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ top: 10, right: 24, bottom: 0, left: 4 }} barCategoryGap={14}>
        <CartesianGrid strokeDasharray="0" stroke="var(--border)" strokeOpacity={0.6} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="label" width={60} tick={{ fontSize: 11.5, fill: "var(--foreground)" }} axisLine={false} tickLine={false} />
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
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" iconSize={8} />
        <Bar dataKey="masculino" name="Masculino" fill="#1B2A4A" radius={[0, 4, 4, 0]} maxBarSize={18} />
        <Bar dataKey="feminino" name="Feminino" fill="#B8935A" radius={[0, 4, 4, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}
