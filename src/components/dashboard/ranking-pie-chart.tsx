"use client";

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

/** Paleta categórica da marca, reordenada para afastar tons próximos (os dois
 * azuis-marinho do PALETTE de RankingBarChart ficam quase indistinguíveis
 * lado a lado numa pizza, onde a cor é a única forma de identificar a fatia). */
const PALETTE = ["#1B2A4A", "#B8935A", "#B23A48", "#4C8B5B", "#C9922E", "#5A5F6B"];

interface PieDatum {
  name: string;
  value: number;
}

/**
 * Agrupa categorias além do limite em "Outros". Pizza só funciona bem pra
 * leitura de parte-do-todo à primeira vista com poucas fatias (~6); passado
 * isso, fatias pequenas demais viram ruído e a cor deixa de discriminar.
 */
function capSlices(data: PieDatum[], maxSlices: number): PieDatum[] {
  if (data.length <= maxSlices) return data;
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, maxSlices - 1);
  const tail = sorted.slice(maxSlices - 1);
  const othersTotal = tail.reduce((sum, d) => sum + d.value, 0);
  return [...head, { name: "Outros", value: othersTotal }];
}

function renderPercentLabel({ percent }: { percent?: number }) {
  if (!percent || percent < 0.05) return "";
  return `${(percent * 100).toFixed(0)}%`;
}

export function RankingPieChart({
  data,
  colors,
  maxSlices = 6,
  valueSuffix = " min",
}: {
  data: PieDatum[];
  colors?: string[];
  maxSlices?: number;
  valueSuffix?: string;
}) {
  const palette = colors ?? PALETTE;
  const sliced = capSlices(data, maxSlices);
  const total = sliced.reduce((sum, d) => sum + d.value, 0);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart margin={{ top: 6, right: 6, bottom: 6, left: 6 }}>
        <Pie
          data={sliced}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="46%"
          outerRadius="78%"
          label={renderPercentLabel}
          labelLine={false}
        >
          {sliced.map((d, i) => (
            <Cell
              key={d.name}
              fill={d.name === "Outros" ? "var(--muted-foreground)" : palette[i % palette.length]}
              stroke="var(--card)"
              strokeWidth={2}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => [
            `${value}${valueSuffix} (${total > 0 ? ((Number(value) / total) * 100).toFixed(0) : 0}%)`,
            name,
          ]}
          contentStyle={{
            borderRadius: 10,
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-md)",
            fontSize: 12,
            padding: "8px 12px",
          }}
          labelStyle={{ fontWeight: 600, marginBottom: 2, color: "var(--foreground)" }}
        />
        <Legend
          verticalAlign="bottom"
          align="center"
          iconType="circle"
          wrapperStyle={{ fontSize: 11.5, color: "var(--foreground)", paddingTop: 8 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
