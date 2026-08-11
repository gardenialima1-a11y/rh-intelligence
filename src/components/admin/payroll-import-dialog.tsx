"use client";

import * as React from "react";
import Papa from "papaparse";
import { useRouter } from "next/navigation";
import { Upload, Loader2, CheckCircle2, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { formatCurrency } from "@/lib/utils";
import { importPayrollReport, type PayrollImportSummary } from "@/actions/payroll-import";

function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function PayrollImportDialog() {
  const [open, setOpen] = React.useState(false);
  const [competence, setCompetence] = React.useState(currentMonthValue());
  const [rows, setRows] = React.useState<Record<string, string>[] | null>(null);
  const [parsing, setParsing] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<PayrollImportSummary | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const router = useRouter();

  function reset() {
    setRows(null);
    setGlobalError(null);
    setSummary(null);
    setCompetence(currentMonthValue());
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setGlobalError(null);
    setSummary(null);
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
    if (!competence) {
      setGlobalError("Escolha o mês de referência da folha.");
      return;
    }
    setSubmitting(true);
    const result = await importPayrollReport(rows, competence);
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
          <FileSpreadsheet className="h-4 w-4" /> Importar folha (custo mensal)
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar folha de pagamento do mês</DialogTitle>
          <DialogDescription>
            No Excel, salve a folha como <strong>CSV UTF-8</strong> (Arquivo → Salvar Como) e envie aqui. O sistema
            reconhece colunas como Matrícula/Código, Nome, Salário Base, Benefícios e Encargos, e atualiza o custo de
            cada colaborador no mês escolhido abaixo. Se um colaborador daquele mês já tiver um lançamento, ele é
            substituído pelo novo valor.
          </DialogDescription>
        </DialogHeader>

        {!summary && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="competence">Mês de referência da folha</Label>
              <input
                id="competence"
                type="month"
                value={competence}
                onChange={(e) => setCompetence(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
              />
            </div>

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
              <CheckCircle2 className="h-4 w-4" /> {summary.created} novo(s) lançamento(s) e {summary.updated} atualizado(s).
            </p>
            <p className="text-xs text-muted-foreground">
              Custo total importado: {formatCurrency(summary.totalCost)}
              {summary.estimatedCount > 0 &&
                ` (${summary.estimatedCount} linha(s) com Benefícios/Encargos estimados em 18%/42% do salário, por não terem coluna própria na planilha)`}
            </p>
            {summary.invalidRows > 0 && (
              <p className="flex items-center gap-2 text-sm text-warning-text">
                <AlertTriangle className="h-4 w-4" /> {summary.invalidRows} linha(s) sem salário válido foram ignoradas.
              </p>
            )}
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
