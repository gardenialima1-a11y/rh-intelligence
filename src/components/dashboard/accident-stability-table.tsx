import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { formatDate, formatNumber } from "@/lib/utils";
import type { AccidentStabilityRow } from "@/services/sst";

export function AccidentStabilityTable({ rows }: { rows: AccidentStabilityRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nenhum acidente com CAT e 15 dias ou mais de afastamento no histórico — ninguém em estabilidade acidentária no momento.
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Colaborador</TableHead>
          <TableHead>Situação</TableHead>
          <TableHead>Data do acidente</TableHead>
          <TableHead>Retorno</TableHead>
          <TableHead>Dias afastado</TableHead>
          <TableHead>Estabilidade até</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.incidentId}>
            <TableCell>{r.employeeName}</TableCell>
            <TableCell>{r.isActive ? <Badge variant="success">Ativo</Badge> : <Badge variant="outline">Inativo</Badge>}</TableCell>
            <TableCell>{formatDate(r.accidentDate)}</TableCell>
            <TableCell>{r.returnDate ? formatDate(r.returnDate) : <span className="text-muted-foreground">Estimado</span>}</TableCell>
            <TableCell>{formatNumber(r.daysLost)}</TableCell>
            <TableCell>{formatDate(r.stabilityEnd)}</TableCell>
            <TableCell>
              {r.emEstabilidade ? (
                <Badge variant="warning">Em estabilidade — faltam {r.diasRestantes} dia(s)</Badge>
              ) : (
                <Badge variant="outline">Estabilidade encerrada</Badge>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
