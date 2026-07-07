"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

const PALETTE = ["#1B2A4A", "#2C4270", "#B8935A", "#4C8B5B", "#5A5F6B", "#C9922E"];

export function BarByUnitChart({ data }: { data: { name: string; headcount: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: 0 }} barCategoryGap={20}>
        <CartesianGrid strokeDasharray="0" stroke="var(--border)" strokeOpacity={0.6} vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} tickMargin={8} />
        <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} width={40} />
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
        <Bar dataKey="headcount" radius={[6, 6, 0, 0]} maxBarSize={56}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
