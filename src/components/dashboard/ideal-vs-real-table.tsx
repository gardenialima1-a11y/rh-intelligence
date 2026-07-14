import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";

interface IdealVsRealRow {
  name: string;
  ideal: number | null;
  real: number;
  diff: number | null;
}

export function IdealVsRealTable({ rows }: { rows: IdealVsRealRow[] }) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nenhum quadro ideal cadastrado ainda.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Setor</TableHead>
          <TableHead>Quadro ideal</TableHead>
          <TableHead>Quadro real</TableHead>
          <TableHead>Diferença</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.name}>
            <TableCell>{r.name}</TableCell>
            <TableCell>{r.ideal ?? "—"}</TableCell>
            <TableCell>{r.real}</TableCell>
            <TableCell>
              {r.diff === null ? (
                "—"
              ) : r.diff === 0 ? (
                <Badge variant="success">Completo</Badge>
              ) : r.diff > 0 ? (
                <Badge variant="gold">+{r.diff} acima</Badge>
              ) : (
                <Badge variant="danger">{r.diff} (faltam {Math.abs(r.diff)})</Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
