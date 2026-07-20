"use client";

import * as React from "react";
import { AlertTriangle, Clock3, FileBarChart } from "lucide-react";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import { COMPLIANCE_TYPE_LABEL } from "@/lib/labels";
import type { DisciplinaryRankingRow } from "@/services/compliance";

const SUGGESTION_VARIANT: Record<string, "outline" | "warning" | "danger"> = {
  "Sem histórico relevante": "outline",
  Acompanhar: "outline",
  "Considerar suspensão": "warning",
  "Reincidência: avaliar desligamento": "danger",
  "Avaliar desligamento por justa causa": "danger",
};

const TYPE_VARIANT: Record<string, "warning" | "danger" | "outline"> = {
  ADVERTENCIA: "warning",
  SUSPENSAO: "danger",
  PROCESSO: "danger",
};

export function DisciplinaryRankingTable({ rows }: { rows: DisciplinaryRankingRow[] }) {
  const [selected, setSelected] = React.useState<DisciplinaryRankingRow | null>(null);

  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nenhum colaborador com advertência, suspensão ou processo registrado.</p>;
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Colaborador</TableHead>
            <TableHead>Unidade</TableHead>
            <TableHead>Advertências</TableHead>
            <TableHead>Suspensões</TableHead>
            <TableHead>Última ocorrência</TableHead>
            <TableHead>Sugestão</TableHead>
            <TableHead className="w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.employeeId}>
              <TableCell>{r.employeeName}</TableCell>
              <TableCell>{r.unitName}</TableCell>
              <TableCell>{r.advertencias}</TableCell>
              <TableCell>{r.suspensoes}</TableCell>
              <TableCell>{formatDate(r.lastEventDate)}</TableCell>
              <TableCell>
                <Badge variant={SUGGESTION_VARIANT[r.suggestion] ?? "outline"}>{r.suggestion}</Badge>
              </TableCell>
              <TableCell>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" onClick={() => setSelected(r)} title="Ver linha do tempo">
                    <Clock3 className="h-3.5 w-3.5" />
                  </Button>
                  <a href={"/relatorios/colaborador/" + r.employeeId} target="_blank" rel="noopener noreferrer" title="Emitir relatorio do colaborador" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-gold hover:text-gold-text">
                    <FileBarChart className="h-3.5 w-3.5" />
                  </a>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Linha do tempo — {selected?.employeeName}</DialogTitle>
            <DialogDescription>
              {selected && (
                <>
                  {selected.advertencias} advertência(s), {selected.suspensoes} suspensão(ões)
                  {selected.processos > 0 && ", " + selected.processos + " processo(s)"}.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selected && (
            <div className="flex flex-col gap-3 border-l-2 border-border pl-4">
              {selected.timeline.map((t) => (
                <div key={t.id} className="relative">
                  <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-gold" />
                  <div className="flex items-center gap-2">
                    <Badge variant={TYPE_VARIANT[t.type] ?? "outline"}>{COMPLIANCE_TYPE_LABEL[t.type] ?? t.type}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(t.date)}</span>
                  </div>
                  <p className="mt-0.5 text-sm">{t.reason ?? "Sem motivo detalhado"}</p>
                </div>
              ))}
            </div>
          )}

          {selected && selected.suggestion !== "Acompanhar" && selected.suggestion !== "Sem histórico relevante" && (
            <p className="flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-xs text-warning-text">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Sugestão automática, baseada só na quantidade e no tipo de ocorrências — não substitui a análise do caso
              (contexto, tempo entre as ocorrências, gravidade) nem orientação jurídica antes de qualquer desligamento.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
