"use client";

import * as React from "react";
import Papa from "papaparse";
import { useRouter } from "next/navigation";
import { Upload, Loader2, CheckCircle2, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { importAttendanceReport, type AttendanceImportSummary } from "@/actions/attendance-import";

const BATCH_SIZE = 250;

function emptySummary(): AttendanceImportSummary {
  return {
    created: 0,
    faltas: 0,
    ferias: 0,
    cargoConfiancaDetectados: 0,
    unmatchedNames: [],
    outros: [],
    diasComJornadaAtualizada: 0,
    horasEsperadasTotais: 0,
    horasPerdidasTotais: 0,
    ausenciasRegistradas: 0,
  };
}

function mergeSummary(acc: AttendanceImportSummary, part: AttendanceImportSummary): AttendanceImportSummary {
  return {
    created: acc.created + part.created,
    faltas: acc.faltas + part.faltas,
    ferias: acc.ferias + part.ferias,
    cargoConfiancaDetectados: acc.cargoConfiancaDetectados + part.cargoConfiancaDetectados,
    unmatchedNames: [...acc.unmatchedNames, ...part.unmatchedNames],
    outros: [...acc.outros, ...part.outros],
    diasComJornadaAtualizada: acc.diasComJornadaAtualizada + part.diasComJornadaAtualizada,
    horasEsperadasTotais: Math.round((acc.horasEsperadasTotais + part.horasEsperadasTotais) * 10) / 10,
    horasPerdidasTotais: Math.round((acc.horasPerdidasTotais + part.horasPerdidasTotais) * 10) / 10,
    ausenciasRegistradas: acc.ausenciasRegistradas + part.ausenciasRegistradas,
  };
}

async function parseExcelFile(file: File): Promise<Record<string, string>[]> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "", raw: false });
}

export function AttendanceImportDialog() {
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<Record<string, string>[] | null>(null);
  const [parsing, setParsing] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<AttendanceImportSummary | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const router = useRouter();

  function reset() {
    setRows(null);
    setGlobalError(null);
    setSummary(null);
    setProgress(null);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    reset();
    setParsing(true);

    const isExcel = /\.(xls|xlsx)$/i.test(file.name);

    if (isExcel) {
      try {
        const parsedRows = await parseExcelFile(file);
        setParsing(false);
        if (parsedRows.length === 0) {
          setGlobalError("A planilha está vazia ou não foi possível lê-la.");
          return;
        }
        setRows(parsedRows);
      } catch {
        setParsing(false);
        setGlobalError("Não foi possível ler o arquivo. Confirme que é um .xls/.xlsx válido.");
      }
      return;
    }

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (parsed) => {
        setParsing(false);
        if (parsed.data.length === 0) {
          setGlobalError("A planilha está vazia ou não foi possível lê-la.");
          return;
        }
        setRows(parsed.data);
      },
      error: () => {
        setParsing(false);
        setGlobalError("Não foi possível ler o arquivo. Confirme que é um .csv válido.");
      },
    });
  }

  async function handleImport() {
    if (!rows) return;
    setSubmitting(true);
    setGlobalError(null);

    const batches: Record<string, string>[][] = [];
    for (let i = 0; i < rows.length; i += BATCH_SIZE) batches.push(rows.slice(i, i + BATCH_SIZE));

    let acc = emptySummary();
    setProgress({ done: 0, total: rows.length });

    for (const batch of batches) {
      const result = await importAttendanceReport(batch);
      if (!result.success) {
        setSubmitting(false);
        setGlobalError(
          `${result.error ?? "Erro ao importar."} (parte do arquivo já foi importada — o que passou não some, é só rodar de novo pra terminar o resto)`
        );
        setSummary(acc.created > 0 ? acc : null);
        router.refresh();
        return;
      }
      acc = mergeSummary(acc, result.summary ?? emptySummary());
      setProgress((p) => ({ done: (p?.done ?? 0) + batch.length, total: rows.length }));
    }

    setSubmitting(false);
    setSummary(acc);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileSpreadsheet className="h-4 w-4" /> Importar relatório de ponto
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar relatório de ponto</DialogTitle>
          <DialogDescription>
            Suba o relatório de ponto direto em <strong>.xls, .xlsx ou .csv</strong> — não precisa mais converter.
            O sistema reconhece as colunas Dia, Nome, Código, Rotina Esperada, Entrada/Saída, Horário Esperado e
            Duração automaticamente: calcula quem faltou, atualiza a jornada esperada/trabalhada de cada dia (base
            da taxa de absenteísmo), registra as ausências e marca sozinho quem é Cargo de Confiança.
          </DialogDescription>
        </DialogHeader>

        {!summary && (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={submitting}
              className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground transition-colors hover:border-gold hover:text-gold-text disabled:cursor-not-allowed disabled:opacity-50"
            >
              {parsing ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
              {parsing ? "Lendo relatório..." : "Clique para escolher o arquivo .xls, .xlsx ou .csv"}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={handleFile}
            />

            {globalError && <p className="text-sm text-danger">{globalError}</p>}

            {rows && !submitting && (
              <p className="flex items-center gap-1.5 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" /> {rows.length} linha(s) prontas para importar
                {rows.length > BATCH_SIZE ? ` (em lotes de ${BATCH_SIZE})` : ""}.
              </p>
            )}

            {submitting && progress && (
              <div className="flex flex-col gap-1.5">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gold transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.round((progress.done / progress.total) * 100))}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Importando {progress.done} de {progress.total} linhas...
                </p>
              </div>
            )}
          </div>
        )}

        {summary && (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" /> {summary.created} registro(s) processados.
            </p>
            <p className="text-xs text-muted-foreground">
              {summary.faltas} falta(s) · {summary.ferias} em férias · {summary.cargoConfiancaDetectados} identificado(s) como Cargo de Confiança
            </p>
            <div className="rounded-lg border border-border p-3 text-sm">
              <p className="font-medium">Taxa de absenteísmo atualizada</p>
              <p className="text-muted-foreground">
                {summary.diasComJornadaAtualizada} dia(s)-colaborador com jornada esperada/trabalhada atualizada ·{" "}
                {summary.horasEsperadasTotais} h esperadas · {summary.horasPerdidasTotais} h perdidas ·{" "}
                {summary.ausenciasRegistradas} ausência(s) registrada(s)
              </p>
            </div>
            {summary.unmatchedNames.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="flex items-center gap-2 text-sm text-warning-text">
                  <AlertTriangle className="h-4 w-4" /> {summary.unmatchedNames.length} nome(s) não encontrados no cadastro:
                </p>
                <div className="max-h-28 overflow-y-auto rounded-lg border border-border p-2 text-xs text-muted-foreground">
                  {summary.unmatchedNames.map((n, i) => <p key={i}>{n}</p>)}
                </div>
              </div>
            )}
            {summary.outros.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="flex items-center gap-2 text-sm text-warning-text">
                  <AlertTriangle className="h-4 w-4" /> {summary.outros.length} com texto não reconhecido (não contado como falta, revise se quiser):
                </p>
                <div className="max-h-28 overflow-y-auto rounded-lg border border-border p-2 text-xs text-muted-foreground">
                  {summary.outros.map((o, i) => <p key={i}>{o.nome}: &quot;{o.texto}&quot;</p>)}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={submitting}>{summary ? "Fechar" : "Cancelar"}</Button>
          </DialogClose>
          {!summary && (
            <Button type="button" variant="gold" onClick={handleImport} disabled={!rows || submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Importando..." : "Importar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
