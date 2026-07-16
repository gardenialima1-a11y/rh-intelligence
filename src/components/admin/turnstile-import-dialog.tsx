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
import { parseTurnstileReport, type ParsedTurnstileEntry } from "@/lib/validation/turnstile-import";
import { bulkImportTurnstileEvents, type TurnstileImportSummary } from "@/actions/turnstile";

export function TurnstileImportDialog() {
  const [open, setOpen] = React.useState(false);
  const [entries, setEntries] = React.useState<ParsedTurnstileEntry[] | null>(null);
  const [parseWarnings, setParseWarnings] = React.useState<string[]>([]);
  const [parsing, setParsing] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [summary, setSummary] = React.useState<TurnstileImportSummary | null>(null);
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const router = useRouter();

  function reset() {
    setEntries(null);
    setParseWarnings([]);
    setSummary(null);
    setGlobalError(null);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    reset();
    setParsing(true);

    Papa.parse<string[]>(file, {
      header: false,
      skipEmptyLines: false,
      complete: (parsed) => {
        setParsing(false);
        const { entries: parsedEntries, warnings } = parseTurnstileReport(parsed.data);
        if (parsedEntries.length === 0) {
          setGlobalError("Não encontrei nenhum evento reconhecível nesse arquivo. Confirme que é o relatório de marcações exportado como CSV.");
          return;
        }
        setEntries(parsedEntries);
        setParseWarnings(warnings);
      },
      error: () => {
        setParsing(false);
        setGlobalError("Não foi possível ler o arquivo. Confirme que é um .csv válido.");
      },
    });
  }

  async function handleImport() {
    if (!entries) return;
    setSubmitting(true);
    const result = await bulkImportTurnstileEvents(entries);
    setSubmitting(false);
    if (!result.success) {
      setGlobalError(result.error ?? "Erro ao importar.");
      return;
    }
    setSummary(result.summary ?? null);
    router.refresh();
  }

  const employeeCount = entries ? new Set(entries.map((e) => e.employeeName)).size : 0;

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
            No Excel, abra o relatório de marcações e salve como <strong>CSV UTF-8</strong> (Arquivo → Salvar Como).
            O sistema reconhece automaticamente os blocos de &quot;Usuário:&quot; e as marcações de Entrada/Saída —
            é o mesmo formato exportado pela catraca, sem precisar reorganizar nada.
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

            {entries && (
              <div className="flex flex-col gap-2">
                <p className="flex items-center gap-1.5 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" /> {entries.length} evento(s) de {employeeCount} funcionário(s) encontrados no arquivo
                </p>
                {parseWarnings.length > 0 && (
                  <div className="max-h-32 overflow-y-auto rounded-lg border border-border p-2 text-xs text-warning-text">
                    {parseWarnings.slice(0, 10).map((w, i) => (
                      <p key={i}>{w}</p>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  O sistema vai tentar casar cada nome com os colaboradores já cadastrados. Nomes que não baterem
                  aparecerão no resultado, sem travar a importação dos demais.
                </p>
              </div>
            )}
          </div>
        )}

        {summary && (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" /> {summary.created} registro(s) de catraca importado(s) com sucesso!
            </p>
            {summary.exemptSkipped > 0 && (
              <p className="text-xs text-muted-foreground">
                {summary.exemptSkipped} registro(s) ignorados de colaborador(es) marcados como isentos de catraca.
              </p>
            )}
            {summary.unmatchedNames.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="flex items-center gap-2 text-sm text-warning-text">
                  <AlertTriangle className="h-4 w-4" /> {summary.unmatchedNames.length} nome(s) do relatório não encontrados no cadastro:
                </p>
                <div className="max-h-32 overflow-y-auto rounded-lg border border-border p-2 text-xs text-muted-foreground">
                  {summary.unmatchedNames.map((n) => (
                    <p key={n}>{n}</p>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Confira se o nome está cadastrado em Colaboradores exatamente (ou bem parecido) com o do relatório.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">{summary ? "Fechar" : "Cancelar"}</Button>
          </DialogClose>
          {!summary && (
            <Button type="button" variant="gold" onClick={handleImport} disabled={!entries || submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Importar {entries ? `(${entries.length})` : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
