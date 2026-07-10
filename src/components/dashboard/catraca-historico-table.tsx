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

export function CatracaHistoricoTable({ data }: { data: HistoricoResult }) {
  if (data.dates.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nenhum histórico importado ainda.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Colaborador</TableHead>
            {data.dates.map((d) => (
              <TableHead key={d}>{formatDateLabel(d)}</TableHead>
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
              {data.dates.map((d) => (
                <TableCell key={d}>{severityBadge(row.byDate[d])}</TableCell>
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
        Setinhas mostram se o colaborador melhorou (verde) ou piorou (vermelho) do primeiro ao último dia do período.
      </p>
    </div>
  );
}
