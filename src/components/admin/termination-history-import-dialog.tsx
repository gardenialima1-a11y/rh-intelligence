"use client";

import * as React from "react";
import Papa from "papaparse";
import { useRouter } from "next/navigation";
import { Upload, Loader2, CheckCircle2, AlertTriangle, History } from "lucide-react";
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
import { importTerminationHistory, type TerminationHistoryImportSummary } from "@/actions/termination-history-import";

export function TerminationHistoryImportDialog() {
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<Record<string, string>[] | null>(null);
  const [parsing, setParsing] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<TerminationHistoryImportSummary | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const router = useRouter();

  function reset() {
    setRows(null);
    setGlobalError(null);
    setSummary(null);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    reset();
    setParsing(true);

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
    const result = await importTerminationHistory(rows);
    setSubmitting(false);
    if (!result.success) {
      setGlobalError(result.error ?? "Erro ao importar.");
      return;
    }
    setSummary(result.summary ?? null);
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
          <History className="h-4 w-4" /> Importar histórico de desligamentos
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar histórico de desligamentos</DialogTitle>
          <DialogDescription>
            No Excel, salve a listagem como <strong>CSV UTF-8</strong> (Arquivo → Salvar Como) e envie aqui. Colunas
            reconhecidas: Nome, Dt. Admissão, Função, Dt. Demissão, Motivo do Desligamento. Colaboradores que ainda
            não existem no cadastro são criados automaticamente (marcados como inativos, com matrícula gerada
            começando em &quot;HIST-&quot;), e o histórico de admissão/desligamento de cada um alimenta os módulos de
            Desligamentos e Turnover. Pode importar a mesma planilha mais de uma vez sem duplicar nada.
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
              {parsing ? "Lendo planilha..." : "Clique para escolher o arquivo .csv"}
            </button>
            <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />

            {globalError && <p className="text-sm text-danger">{globalError}</p>}

            {rows && (
              <p className="flex items-center gap-1.5 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" /> {rows.length} linha(s) prontas para importar.
              </p>
            )}
          </div>
        )}

        {summary && (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" /> {summary.peopleProcessed} pessoa(s) processada(s).
            </p>
            <p className="text-xs text-muted-foreground">
              {summary.newEmployeesCreated} colaborador(es) histórico(s) criado(s) · {summary.matchedExistingEmployees} já
              existiam no cadastro e foram só complementados · {summary.movementsCreated} movimentação(ões) de
              admissão/desligamento gravada(s).
            </p>
            {(summary.skippedInvalidRows > 0 || summary.skippedNoName > 0) && (
              <p className="flex items-center gap-2 text-sm text-warning-text">
                <AlertTriangle className="h-4 w-4" />
                {summary.skippedInvalidRows} linha(s) com data inválida e {summary.skippedNoName} sem nome foram
                ignoradas.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">{summary ? "Fechar" : "Cancelar"}</Button>
          </DialogClose>
          {!summary && (
            <Button type="button" variant="gold" onClick={handleImport} disabled={!rows || submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Importar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
