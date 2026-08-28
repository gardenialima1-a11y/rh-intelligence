"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { TrendingUp, TrendingDown, Minus, Search } from "lucide-react";
import type { HistoricoResult } from "@/services/catraca-historico";

function formatMinutes(m: number | null): string {
  if (m === null) return "—";
  if (m === 0) return "0min";
  const h = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h ${min}m` : `${min}min`;
}

function severityBadge(m: number | null) {
  if (m === null) return <span className="text-muted-foreground">—</span>;
  if (m < 20) return <Badge variant="success">{formatMinutes(m)}</Badge>;
  if (m < 45) return <Badge variant="warning">{formatMinutes(m)}</Badge>;
  return <Badge variant="danger">{formatMinutes(m)}</Badge>;
}

function formatDateLabel(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const fmt = new Intl.DateTimeFormat("pt-BR", { month: "short" });
  return fmt.format(new Date(y, m - 1, 1)).replace(".", "");
}

interface DisplayColumn {
  key: string;
  label: string;
  isGrouped: boolean;
  memberDates: string[];
}

/**
 * Agrupa datas por mês (só pra exibição — os dados por dia continuam intactos
 * por baixo, não é uma agregação real). Meses fechados viram UMA coluna só
 * (com a média diária do mês); o mês vigente continua aparecendo dia a dia,
 * pra dar visibilidade do que está acontecendo agora sem deixar a tabela
 * gigante com todo o histórico em colunas separadas.
 */
function buildDisplayColumns(dates: string[]): DisplayColumn[] {
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const monthGroups = new Map<string, string[]>();
  for (const d of dates) {
    const monthKey = d.slice(0, 7);
    const list = monthGroups.get(monthKey) ?? [];
    list.push(d);
    monthGroups.set(monthKey, list);
  }

  const columns: DisplayColumn[] = [];
  for (const monthKey of Array.from(monthGroups.keys()).sort()) {
    const datesInMonth = [...monthGroups.get(monthKey)!].sort();
    if (monthKey === currentMonthKey) {
      for (const d of datesInMonth) {
        columns.push({ key: d, label: formatDateLabel(d), isGrouped: false, memberDates: [d] });
      }
    } else {
      columns.push({ key: monthKey, label: formatMonthLabel(monthKey), isGrouped: true, memberDates: datesInMonth });
    }
  }
  return columns;
}

/** Valor de uma coluna pra uma linha: o dia em si (colunas normais) ou a média diária do mês (colunas agrupadas). */
function valueForColumn(byDate: Record<string, number | null>, col: DisplayColumn): number | null {
  if (!col.isGrouped) return byDate[col.key] ?? null;
  const vals = col.memberDates.map((d) => byDate[d]).filter((v): v is number => v !== null);
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
}

export function CatracaHistoricoTable({ data }: { data: HistoricoResult }) {
  const [search, setSearch] = React.useState("");

  if (data.dates.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nenhum histórico importado ainda.</p>;
  }

  const columns = buildDisplayColumns(data.dates);
  const hasGrouped = columns.some((c) => c.isGrouped);

  // Sempre em ordem alfabética (independente do que veio do serviço), e
  // filtrando por nome antes de exibir. A ordenação roda sobre uma cópia
  // do array pra não mexer nos dados originais recebidos via prop.
  const sortedRows = [...data.rows].sort((a, b) =>
    a.employeeName.localeCompare(b.employeeName, "pt-BR", { sensitivity: "base" })
  );
  const query = search.trim().toLowerCase();
  const filteredRows = query
    ? sortedRows.filter((row) => row.employeeName.toLowerCase().includes(query))
    : sortedRows;

  // Coluna "Colaborador" fixa (sticky) na rolagem horizontal, e altura
  // limitada com rolagem própria: assim a barra de rolagem horizontal fica
  // sempre visível logo abaixo das linhas, em vez de só aparecer lá embaixo
  // no final da página quando a tabela tem muitas linhas.
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar colaborador..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {filteredRows.length} de {sortedRows.length}
        </span>
      </div>

      {filteredRows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Nenhum colaborador encontrado para &quot;{search.trim()}&quot;.</p>
      ) : (
        <Table containerClassName="max-h-[480px]">
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-20 bg-muted">Colaborador</TableHead>
              {columns.map((c) => (
                <TableHead key={c.key} className={c.isGrouped ? "capitalize" : ""}>
                  {c.label}
                  {c.isGrouped && <span className="ml-1 text-[9px] font-normal text-muted-foreground">(méd.)</span>}
                </TableHead>
              ))}
              <TableHead>Tendência</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map((row) => (
              <TableRow key={row.employeeName}>
                <TableCell className="sticky left-0 z-10 whitespace-normal bg-card">
                  {row.employeeName}
                  {!row.employeeId && (
                    <span className="ml-1.5 text-[10px] text-muted-foreground">(não cadastrado)</span>
                  )}
                </TableCell>
                {columns.map((c) => (
                  <TableCell key={c.key}>{severityBadge(valueForColumn(row.byDate, c))}</TableCell>
                ))}
                <TableCell>
                  {row.trend === "up" && <TrendingUp className="h-4 w-4 text-danger" />}
                  {row.trend === "down" && <TrendingDown className="h-4 w-4 text-success" />}
                  {row.trend === "flat" && <Minus className="h-4 w-4 text-muted-foreground" />}
                  {row.trend === null && "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      <p className="text-xs text-muted-foreground">
        Verde: abaixo de 20min fora do posto no dia · Amarelo: 20–45min · Vermelho: acima de 45min.
        {hasGrouped && " Colunas de meses fechados mostram a média diária do mês (\"méd.\"); o mês atual continua dia a dia."}
        {" "}Setinhas mostram se o colaborador melhorou (verde) ou piorou (vermelho) do primeiro ao último dia do período.
      </p>
    </div>
  );
}
