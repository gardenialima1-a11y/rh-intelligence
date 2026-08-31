"use client";

import * as React from "react";
import { FileDown, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Padrão ao abrir o diálogo: últimos 12 meses até hoje — ajustável livremente. */
function defaultRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end);
  start.setMonth(start.getMonth() - 12);
  return { start: toISODate(start), end: toISODate(end) };
}

/**
 * Botão + diálogo para exportar o relatório gerencial da Catraca em PDF
 * escolhendo livremente a data inicial e final (ex.: 01/08/2025 a
 * 31/08/2026), em vez de ficar preso ao filtro fixo de período da tela.
 * A unidade continua sendo a mesma já selecionada no filtro global (e,
 * para perfis não corporativos, a rota da API reforça o próprio escopo).
 */
export function CatracaReportExportDialog({ unitId }: { unitId?: string }) {
  const [open, setOpen] = React.useState(false);
  const defaults = React.useMemo(() => defaultRange(), []);
  const [startDate, setStartDate] = React.useState(defaults.start);
  const [endDate, setEndDate] = React.useState(defaults.end);
  const [error, setError] = React.useState<string | null>(null);
  const [downloading, setDownloading] = React.useState(false);

  function handleExport() {
    if (!startDate || !endDate) {
      setError("Informe a data inicial e a data final.");
      return;
    }
    if (startDate > endDate) {
      setError("A data inicial não pode ser depois da data final.");
      return;
    }
    setError(null);
    setDownloading(true);

    const params = new URLSearchParams();
    if (unitId) params.set("unidade", unitId);
    params.set("inicio", startDate);
    params.set("fim", endDate);

    window.location.href = `/api/reports/catraca?${params.toString()}`;
    setTimeout(() => setDownloading(false), 1500);
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) {
          setStartDate(defaults.start);
          setEndDate(defaults.end);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileDown className="h-3.5 w-3.5" /> Exportar relatório (PDF)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Exportar relatório gerencial da Catraca</DialogTitle>
          <DialogDescription>
            Escolha o período do relatório (ex.: 01/08/2025 a 31/08/2026) e baixe o PDF com os indicadores, horário
            de pico, distribuição por área, evolução mensal e ranking de colaboradores desse intervalo.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="catraca-report-start">Data inicial</Label>
            <Input
              id="catraca-report-start"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setError(null);
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="catraca-report-end">Data final</Label>
            <Input
              id="catraca-report-end"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setError(null);
              }}
            />
          </div>
        </div>

        {error && (
          <p className="flex items-center gap-2 text-sm text-danger">
            <AlertTriangle className="h-4 w-4" /> {error}
          </p>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancelar
            </Button>
          </DialogClose>
          <Button type="button" variant="gold" onClick={handleExport} disabled={downloading}>
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            Baixar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
