"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatNumber } from "@/lib/utils";
import type { AbsenteeismoMonthBreakdown } from "@/services/absenteismo";

interface ChartPoint extends AbsenteeismoMonthBreakdown {
  name: string;
  value: number;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartPoint }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;

  return (
    <div
      className="rounded-xl border border-border bg-card p-3 text-xs shadow-[var(--shadow-md)]"
      style={{ minWidth: 230 }}
    >
      <div className="mb-1.5 flex items-center gap-1.5">
        <span className="font-semibold text-navy dark:text-cream">{d.name}</span>
        {d.isAlta && (
          <span className="rounded-full bg-warning/12 px-1.5 py-0.5 text-[10px] font-semibold text-warning-text">
            Acima da média
          </span>
        )}
      </div>
      {d.occurrences === 0 ? (
        <p className="text-muted-foreground">Sem ausências registradas.</p>
      ) : (
        <div className="flex flex-col gap-1 text-muted-foreground">
          <p>
            Taxa: <strong className="text-foreground">{d.value.toFixed(1)}%</strong> · {formatNumber(d.hoursLost)}h perdidas ·{" "}
            {d.occurrences} ocorrência(s)
          </p>
          <p>
            Com atestado: <strong className="text-foreground">{Math.round(d.percentComAtestado * 100)}%</strong> · Sem
            atestado: <strong className="text-foreground">{Math.round(d.percentSemAtestado * 100)}%</strong>
          </p>
          {d.setorSecundarioMaisImpactado && (
            <p>
              Setor secundário mais impactado:{" "}
              <strong className="text-foreground">{d.setorSecundarioMaisImpactado.name}</strong>
            </p>
          )}
          {d.motivoPrincipal && (
            <p>
              Motivo mais frequente: <strong className="text-foreground">{d.motivoPrincipal.label}</strong>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function HighRateDot(props: { cx?: number; cy?: number; payload?: ChartPoint }) {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined || !payload?.isAlta) return <g />;
  return <circle cx={cx} cy={cy} r={4} fill="var(--warning)" stroke="var(--card)" strokeWidth={1.5} />;
}

export function AbsenteeismTrendChart({
  data,
  color = "#C9922E",
}: {
  data: AbsenteeismoMonthBreakdown[];
  color?: string;
}) {
  const chartData: ChartPoint[] = data.map((m) => ({ ...m, name: m.label, value: m.rate * 100 }));
  const gradientId = `absTrendFill-${color.replace("#", "")}`;

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
          content={<CustomTooltip />}
          cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2.5}
          fill={`url(#${gradientId})`}
          dot={<HighRateDot />}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
