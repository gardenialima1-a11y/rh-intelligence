import { FileBarChart, FileDown } from "lucide-react";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { ClosedVacancyRow } from "@/services/vacancy-report";

export function ClosedVacanciesTable({ rows }: { rows: ClosedVacancyRow[] }) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma vaga fechada ainda.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Vaga</TableHead>
          <TableHead>Unidade</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Contratado(a)</TableHead>
          <TableHead>Fechada em</TableHead>
          <TableHead>Dias até fechar</TableHead>
          <TableHead>Observação da negociação</TableHead>
          <TableHead className="w-10"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((v) => (
          <TableRow key={v.id}>
            <TableCell>{v.title}</TableCell>
            <TableCell>{v.unitName ?? "—"}</TableCell>
            <TableCell>
              <Badge variant={v.status === "PREENCHIDA" ? "success" : "outline"}>
                {v.status === "PREENCHIDA" ? "Preenchida" : "Cancelada"}
              </Badge>
            </TableCell>
            <TableCell>{v.hiredCandidateName ?? "—"}</TableCell>
            <TableCell>{v.closedAt ? formatDate(v.closedAt) : "—"}</TableCell>
            <TableCell>{v.daysToClose ?? "—"}</TableCell>
            <TableCell className="max-w-[220px] truncate" title={v.negotiationNotes ?? undefined}>
              {v.negotiationNotes ?? "—"}
            </TableCell>
            <TableCell>
              <div className="flex gap-2">
                <a href={"/relatorios/vaga/" + v.id} target="_blank" rel="noopener noreferrer" title="Ver relatório da vaga" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-gold hover:text-gold-text">
                  <FileBarChart className="h-3.5 w-3.5" />
                </a>
                <a href={"/api/reports/vaga/" + v.id} title="Baixar PDF da vaga" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-gold hover:text-gold-text">
                  <FileDown className="h-3.5 w-3.5" />
                </a>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
