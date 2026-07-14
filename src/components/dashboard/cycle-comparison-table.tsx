import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import type { CycleComparisonResult } from "@/services/clima";

export function CycleComparisonTable({ data }: { data: CycleComparisonResult }) {
  if (data.cycles.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nenhum ciclo importado ainda.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Dimensão</TableHead>
          {data.cycles.map((c) => (
            <TableHead key={c}>{c}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="font-medium">eNPS</TableCell>
          {data.cycles.map((c) => (
            <TableCell key={c}>
              {data.enpsByCycle[c] !== undefined ? <Badge variant="gold">{data.enpsByCycle[c]}</Badge> : "—"}
            </TableCell>
          ))}
        </TableRow>
        {data.rows.map((row) => (
          <TableRow key={row.dimension}>
            <TableCell className="whitespace-normal">{row.dimension}</TableCell>
            {data.cycles.map((c) => (
              <TableCell key={c}>
                {row.byCycle[c] !== undefined ? (
                  <Badge variant={row.byCycle[c] >= 70 ? "success" : row.byCycle[c] >= 50 ? "warning" : "danger"}>
                    {row.byCycle[c]}%
                  </Badge>
                ) : (
                  "—"
                )}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
