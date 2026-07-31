import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import type { IncidentTypeBreakdownRow } from "@/services/sst";

export function IncidentsByTypeTable({ rows }: { rows: IncidentTypeBreakdownRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tipo</TableHead>
          <TableHead>Quantidade</TableHead>
          <TableHead>Com CAT</TableHead>
          <TableHead>Dias perdidos</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.type}>
            <TableCell>
              <Badge variant={r.type === "ACIDENTE" ? "danger" : r.type === "NEAR_MISS" ? "warning" : "outline"}>{r.label}</Badge>
            </TableCell>
            <TableCell>{formatNumber(r.total)}</TableCell>
            <TableCell>{formatNumber(r.comCAT)}</TableCell>
            <TableCell>{formatNumber(r.diasPerdidos)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
