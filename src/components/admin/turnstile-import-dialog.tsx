"use client";

import * as React from "react";
import Papa from "papaparse";
import { useRouter } from "next/navigation";
import { Upload, Loader2, CheckCircle2, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
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
import {
  validateTurnstileImportRow,
  type TurnstileImportRow,
  type TurnstileRowResult,
} from "@/lib/validation/turnstile-import";
import { bulkImportTurnstileEvents, type TurnstileImportSummary } from "@/actions/turnstile";

const HEADER_MAP: Record<string, keyof TurnstileImportRow> = {
  "matrícula": "matricula",
  "matricula": "matricula",
  "data e hora": "dataHora",
  "data/hora": "dataHora",
  "data hora": "dataHora",
  "direção": "direcao",
  "direcao": "direcao",
  "local": "local",
};

function mapCsvRow(raw: Record<string, string>): TurnstileImportRow {
  const row: TurnstileImportRow = { matricula: "", dataHora: "", direcao: "", local: "" };
  for (const [key, value] of Object.entries(raw)) {
    const field = HEADER_MAP[key.trim().toLowerCase()];
    if (field) row[field] = (value ?? "").toString().trim();
  }
  return row;
}

export function TurnstileImportDialog({ registrationToId }: { registrationToId: Record<string, string> }) {
  const [open, setOpen] = React.useState(false);
  const [results, setResults] = React.useState<TurnstileRowResult[] | null>(null);
  const [parsing, setParsing] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [summary, setSummary] = React.useState<TurnstileImportSummary | null>(null);
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const router = useRouter();

  function reset() {
    setResults(null);
    setSummary(null);
    setGlobalError(null);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    reset();
    setParsing(true);

    const employeeMap = new Map(Object.entries(registrationToId));

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (parsed) => {
        setParsing(false);
        if (parsed.data.length === 0) {
          setGlobalError("A planilha está vazia ou não foi possível lê-la.");
          return;
        }
        const rowResults = parsed.data.map((raw, i) => validateTurnstileImportRow(mapCsvRow(raw), i + 2, employeeMap));
        setResults(rowResults);
      },
      error: () => {
        setParsing(false);
        setGlobalError("Não foi possível ler o arquivo. Confirme que é um .csv válido.");
      },
    });
  }

  async function handleImport() {
    if (!results) return;
    setSubmitting(true);
    const result = await bulkImportTurnstileEvents(results);
    setSubmitting(false);
    if (!result.success) {
      setGlobalError(result.error ?? "Erro ao importar.");
      return;
    }
    setSummary(result.summary ?? null);
    router.refresh();
  }

  const validCount = results?.filter((r) => r.data !== null).length ?? 0;
  const invalidRows = results?.filter((r) => r.data === null) ?? [];

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
          <FileSpreadsheet className="h-4 w-4" /> Importar relatório de catraca
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar relatório de catraca (CSV)</DialogTitle>
          <DialogDescription>
            O arquivo precisa ter as colunas: <strong>Matrícula, Data e Hora, Direção</strong> (Entrada/Saída) e{" "}
            <strong>Local</strong> (opcional). Depois de importado, os indicadores de tempo fora do posto são
            calculados automaticamente — nada mais precisa ser feito.
          </DialogDescription>
        </DialogHeader>

        {!summary && (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground transition-colors hover:border-gold hover:text-gold-text"
            >
              {parsing ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
              {parsing ? "Lendo relatório..." : "Clique para escolher o arquivo .csv"}
            </button>
            <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />

            {globalError && <p className="text-sm text-danger">{globalError}</p>}

            {results && (
              <div className="flex flex-col gap-3">
                <div className="flex gap-4 text-sm">
                  <span className="flex items-center gap-1.5 text-success">
                    <CheckCircle2 className="h-4 w-4" /> {validCount} registro(s) prontos para importar
                  </span>
                  {invalidRows.length > 0 && (
                    <span className="flex items-center gap-1.5 text-danger">
                      <AlertTriangle className="h-4 w-4" /> {invalidRows.length} linha(s) com erro
                    </span>
                  )}
                </div>

                {invalidRows.length > 0 && (
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Linha</TableHead>
                          <TableHead>Erros</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invalidRows.map((r) => (
                          <TableRow key={r.rowNumber}>
                            <TableCell>{r.rowNumber}</TableCell>
                            <TableCell className="whitespace-normal text-xs text-danger">{r.errors.join(" · ")}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {summary && (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" /> {summary.created} registro(s) de catraca importado(s) com sucesso!
            </p>
            {summary.skipped > 0 && (
              <p className="flex items-center gap-2 text-sm text-warning-text">
                <AlertTriangle className="h-4 w-4" /> {summary.skipped} linha(s) não importadas (veja os erros acima antes de fechar).
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">{summary ? "Fechar" : "Cancelar"}</Button>
          </DialogClose>
          {!summary && (
            <Button type="button" variant="gold" onClick={handleImport} disabled={!results || validCount === 0 || submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Importar {validCount > 0 ? `(${validCount})` : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
