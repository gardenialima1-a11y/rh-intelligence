import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import type { OvertimeBySectorRow } from "@/services/jornada";

export function OvertimeBySectorTable({ rows }: { rows: OvertimeBySectorRow[] }) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Sem horas extras registradas no período.</p>;
  }

  const totalHours = rows.reduce((acc, r) => acc + r.hours, 0);
  const totalCost = rows.reduce((acc, r) => acc + r.cost, 0);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Setor secundário</TableHead>
          <TableHead>Horas extras</TableHead>
          <TableHead>Custo</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.name}>
            <TableCell>{r.name}</TableCell>
            <TableCell>{r.hours.toLocaleString("pt-BR")} h</TableCell>
            <TableCell>{formatCurrency(r.cost)}</TableCell>
          </TableRow>
        ))}
        <TableRow className="font-semibold">
          <TableCell>Total</TableCell>
          <TableCell>{totalHours.toLocaleString("pt-BR")} h</TableCell>
          <TableCell>{formatCurrency(totalCost)}</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}
