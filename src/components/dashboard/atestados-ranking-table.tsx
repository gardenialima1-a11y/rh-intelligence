import { FileBarChart } from "lucide-react";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { formatDate, formatNumber } from "@/lib/utils";
import type { AtestadoRankingRow } from "@/actions/absences";

export function AtestadosRankingTable({ rows }: { rows: AtestadoRankingRow[] }) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nenhum atestado registrado ainda.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Colaborador</TableHead>
          <TableHead>Unidade</TableHead>
          <TableHead>Qtd. atestados</TableHead>
          <TableHead>Horas perdidas</TableHead>
          <TableHead>Última ocorrência</TableHead>
          <TableHead className="w-10"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.employeeId}>
            <TableCell>{r.employeeName}</TableCell>
            <TableCell>{r.unitName}</TableCell>
            <TableCell>{formatNumber(r.totalAtestados)}</TableCell>
            <TableCell>{formatNumber(r.totalHoursLost)}h</TableCell>
            <TableCell>{formatDate(r.lastOccurrence)}</TableCell>
            <TableCell>
              
                href={"/relatorios/colaborador/" + r.employeeId}
                target="_blank"
                rel="noopener noreferrer"
                title="Emitir relatório do colaborador"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-gold hover:text-gold-text"
              >
                <FileBarChart className="h-3.5 w-3.5" />
              </a>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
