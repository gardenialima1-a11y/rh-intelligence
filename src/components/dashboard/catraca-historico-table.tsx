import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
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
  if (data.dates.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nenhum histórico importado ainda.</p>;
  }

  const columns = buildDisplayColumns(data.dates);
  const hasGrouped = columns.some((c) => c.isGrouped);

  return (
    <div className="flex flex-col gap-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Colaborador</TableHead>
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
          {data.rows.map((row) => (
            <TableRow key={row.employeeName}>
              <TableCell className="whitespace-normal">
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
      <p className="text-xs text-muted-foreground">
        Verde: abaixo de 20min fora do posto no dia · Amarelo: 20–45min · Vermelho: acima de 45min.
        {hasGrouped && " Colunas de meses fechados mostram a média diária do mês (\"méd.\"); o mês atual continua dia a dia."}
        {" "}Setinhas mostram se o colaborador melhorou (verde) ou piorou (vermelho) do primeiro ao último dia do período.
      </p>
    </div>
  );
}
