"use client";

import * as React from "react";
import Papa from "papaparse";
import { useRouter } from "next/navigation";
import { Upload, Loader2, CheckCircle2, AlertTriangle, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
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
  importSafetyIncidents,
  previewUnmatchedSafetyIncidentNames,
  type SafetyIncidentImportRow,
  type SafetyIncidentsImportSummary,
} from "@/actions/safety-incidents-import";

const BATCH_SIZE = 60;
const IGNORE_VALUE = "__ignorar__";

function emptySummary(): SafetyIncidentsImportSummary {
  return { linhasProcessadas: 0, criadas: 0, porTipo: { ACIDENTE: 0, NEAR_MISS: 0, INCIDENTE_DESVIO: 0 }, nomesIgnorados: [] };
}

function mergeSummary(acc: SafetyIncidentsImportSummary, part: SafetyIncidentsImportSummary): SafetyIncidentsImportSummary {
  return {
    linhasProcessadas: acc.linhasProcessadas + part.linhasProcessadas,
    criadas: acc.criadas + part.criadas,
    porTipo: {
      ACIDENTE: acc.porTipo.ACIDENTE + part.porTipo.ACIDENTE,
      NEAR_MISS: acc.porTipo.NEAR_MISS + part.porTipo.NEAR_MISS,
      INCIDENTE_DESVIO: acc.porTipo.INCIDENTE_DESVIO + part.porTipo.INCIDENTE_DESVIO,
    },
    nomesIgnorados: [...acc.nomesIgnorados, ...part.nomesIgnorados],
  };
}

function cellToIsoDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "string") {
    const match = value.trim().match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (match) {
      const [, d, m, yRaw] = match;
      const y = yRaw.length === 2 ? 2000 + Number(yRaw) : Number(yRaw);
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  return null;
}

async function parseExcelFile(file: File): Promise<Record<string, unknown>[]> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
}

/** Pega um valor de coluna ignorando espaços extras e acentos/maiúsculas no nome do cabeçalho. */
function col(row: Record<string, unknown>, ...names: string[]): unknown {
  for (const name of names) {
    if (name in row) return row[name];
  }
  const keys = Object.keys(row);
  for (const name of names) {
    const key = keys.find((k) => k.trim().toUpperCase() === name.toUpperCase());
    if (key) return row[key];
  }
  return undefined;
}

function toIncidentRows(raw: Record<string, unknown>[]): SafetyIncidentImportRow[] {
  const rows: SafetyIncidentImportRow[] = [];
  for (const r of raw) {
    const iso = cellToIsoDate(col(r, "DATA"));
    if (!iso) continue;
    const dataRetornoRaw = col(r, "DATA RETORNO", "RETORNO");
    const dataRetornoIso = cellToIsoDate(dataRetornoRaw) ?? "";
    rows.push({
      data: iso,
      nome: String(col(r, "COLABORADOR", "COLABORADORES") ?? "").trim(),
      tipo: String(col(r, "TIPO") ?? "").trim(),
      cat: String(col(r, "CAT") ?? "").trim(),
      diasAfastado: Number(col(r, "DIAS AFASTADO", "DIAS/AFAST", "DIAS")) || 0,
      dataRetorno: dataRetornoIso,
      descricao: String(col(r, "DESCRIÇÃO", "DESCRICAO") ?? "").trim(),
    });
  }
  return rows;
}

type Step = "upload" | "confirm-unmatched" | "importing" | "done";

export function SafetyIncidentsImportDialog() {
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<Step>("upload");
  const [rows, setRows] = React.useState<SafetyIncidentImportRow[] | null>(null);
  const [parsing, setParsing] = React.useState(false);
  const [checkingMatches, setCheckingMatches] = React.useState(false);
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<SafetyIncidentsImportSummary | null>(null);
  const [unmatchedNames, setUnmatchedNames] = React.useState<string[]>([]);
  const [employees, setEmployees] = React.useState<{ id: string; name: string }[]>([]);
  const [matchChoices, setMatchChoices] = React.useState<Record<string, string>>({});
  const inputRef = React.useRef<HTMLInputElement>(null);
  const router = useRouter();

  function reset() {
    setStep("upload");
    setRows(null);
    setGlobalError(null);
    setSummary(null);
    setProgress(null);
    setUnmatchedNames([]);
    setEmployees([]);
    setMatchChoices({});
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    reset();
    setParsing(true);

    const isExcel = /\.(xls|xlsx)$/i.test(file.name);
    let parsedRows: SafetyIncidentImportRow[] = [];

    if (isExcel) {
      try {
        const raw = await parseExcelFile(file);
        parsedRows = toIncidentRows(raw);
      } catch {
        setParsing(false);
        setGlobalError("Não foi possível ler o arquivo. Confirme que é um .xls/.xlsx válido.");
        return;
      }
    } else {
      const raw = await new Promise<Record<string, unknown>[] | null>((resolve) => {
        Papa.parse<Record<string, unknown>>(file, {
          header: true,
          skipEmptyLines: true,
          complete: (parsed) => resolve(parsed.data),
          error: () => resolve(null),
        });
      });
      if (!raw) {
        setParsing(false);
        setGlobalError("Não foi possível ler o arquivo. Confirme que é um .csv válido.");
        return;
      }
      parsedRows = toIncidentRows(raw);
    }

    if (parsedRows.length === 0) {
      setParsing(false);
      setGlobalError("Não encontrei nenhuma linha válida. Confira se as colunas são DATA, COLABORADOR, TIPO, CAT, DIAS AFASTADO, DATA RETORNO e DESCRIÇÃO.");
      return;
    }

    setRows(parsedRows);
    setParsing(false);
    setCheckingMatches(true);

    const uniqueNames = Array.from(new Set(parsedRows.map((r) => r.nome).filter(Boolean)));
    const preview = await previewUnmatchedSafetyIncidentNames(uniqueNames);
    setCheckingMatches(false);
    if (!preview.success) {
      setGlobalError(preview.error ?? "Não foi possível conferir os colaboradores do arquivo.");
      return;
    }
    setEmployees(preview.employees ?? []);
    if ((preview.unmatchedNames ?? []).length > 0) {
      setUnmatchedNames(preview.unmatchedNames ?? []);
      setStep("confirm-unmatched");
    } else {
      setStep("upload");
    }
  }

  async function runImport() {
    if (!rows) return;
    setStep("importing");
    setGlobalError(null);

    const overrides: Record<string, string> = {};
    for (const name of unmatchedNames) {
      const choice = matchChoices[name];
      if (choice && choice !== IGNORE_VALUE) overrides[name] = choice;
    }

    const batches: SafetyIncidentImportRow[][] = [];
    for (let i = 0; i < rows.length; i += BATCH_SIZE) batches.push(rows.slice(i, i + BATCH_SIZE));

    let acc = emptySummary();
    setProgress({ done: 0, total: rows.length });

    for (const batch of batches) {
      const result = await importSafetyIncidents(batch, overrides);
      if (!result.success) {
        setGlobalError(`${result.error ?? "Erro ao importar."} (o que já passou foi salvo — rode de novo pra terminar o resto)`);
        setSummary(acc.linhasProcessadas > 0 ? acc : null);
        setStep("done");
        router.refresh();
        return;
      }
      acc = mergeSummary(acc, result.summary ?? emptySummary());
      setProgress((p) => ({ done: (p?.done ?? 0) + batch.length, total: rows.length }));
    }

    setSummary(acc);
    setStep("done");
    router.refresh();
  }

  const allResolved = unmatchedNames.every((n) => Boolean(matchChoices[n]));

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
          <FileSpreadsheet className="h-4 w-4" /> Importar ocorrências
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar acidentes, quase acidentes e incidentes/desvios</DialogTitle>
          <DialogDescription>
            Suba a planilha com as colunas <strong>DATA, COLABORADOR, TIPO, CAT, DIAS AFASTADO, DATA RETORNO e
            DESCRIÇÃO</strong>. Em TIPO, aceita &quot;Acidente&quot;, &quot;Quase acidente&quot; ou
            &quot;Incidente/Desvio&quot; (não precisa ser exatamente assim, o sistema reconhece variações). A coluna
            COLABORADOR pode ficar em branco se a ocorrência não for ligada a uma pessoa específica.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={parsing || checkingMatches}
              className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground transition-colors hover:border-gold hover:text-gold-text disabled:cursor-not-allowed disabled:opacity-50"
            >
              {parsing || checkingMatches ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
              {parsing ? "Lendo planilha..." : checkingMatches ? "Conferindo colaboradores do cadastro..." : "Clique para escolher o arquivo .xls, .xlsx ou .csv"}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv,.xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={handleFile}
            />

            {globalError && <p className="text-sm text-danger">{globalError}</p>}

            {rows && !parsing && !checkingMatches && (
              <p className="flex items-center gap-1.5 text-sm text-success">
                <CheckCircle2 className="h-4 w-4" /> {rows.length} ocorrência(s) prontas para importar. Todos os nomes bateram com o cadastro.
              </p>
            )}
          </div>
        )}

        {step === "confirm-unmatched" && (
          <div className="flex flex-col gap-3">
            <p className="flex items-center gap-2 text-sm text-warning-text">
              <AlertTriangle className="h-4 w-4" /> {unmatchedNames.length} nome(s) do arquivo não bateram com
              ninguém do cadastro. Escolha o colaborador certo pra cada um, ou marque &quot;Ignorar&quot; pra deixar
              esse nome de fora da importação.
            </p>
            <div className="flex max-h-80 flex-col gap-2 overflow-y-auto rounded-lg border border-border p-2">
              {unmatchedNames.map((name) => (
                <div key={name} className="flex flex-wrap items-center justify-between gap-2 rounded-md p-1.5">
                  <span className="text-sm">{name}</span>
                  <Select
                    value={matchChoices[name] ?? undefined}
                    onValueChange={(v) => setMatchChoices((prev) => ({ ...prev, [name]: v }))}
                  >
                    <SelectTrigger className="h-8 w-56"><SelectValue placeholder="Selecionar colaborador" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={IGNORE_VALUE}>Ignorar esse nome</SelectItem>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            {globalError && <p className="text-sm text-danger">{globalError}</p>}
          </div>
        )}

        {(step === "importing" || (step === "done" && progress)) && (
          <div className="flex flex-col gap-1.5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gold transition-all duration-300"
                style={{ width: `${Math.min(100, Math.round(((progress?.done ?? 0) / (progress?.total ?? 1)) * 100))}%` }}
              />
            </div>
            {step === "importing" && (
              <p className="text-xs text-muted-foreground">
                Importando {progress?.done ?? 0} de {progress?.total ?? 0} ocorrências...
              </p>
            )}
          </div>
        )}

        {step === "done" && summary && (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" /> {summary.criadas} ocorrência(s) registrada(s).
            </p>
            <div className="rounded-lg border border-border p-3 text-sm text-muted-foreground">
              {summary.porTipo.ACIDENTE} acidente(s) · {summary.porTipo.NEAR_MISS} quase acidente(s) ·{" "}
              {summary.porTipo.INCIDENTE_DESVIO} incidente(s)/desvio(s)
            </div>
            {summary.nomesIgnorados.length > 0 && (
              <p className="flex items-center gap-2 text-sm text-warning-text">
                <AlertTriangle className="h-4 w-4" /> {summary.nomesIgnorados.length} linha(s) com nomes ignorados ficaram de fora.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={step === "importing"}>
              {step === "done" ? "Fechar" : "Cancelar"}
            </Button>
          </DialogClose>
          {step === "upload" && rows && (
            <Button type="button" variant="gold" onClick={runImport} disabled={parsing || checkingMatches}>
              Importar
            </Button>
          )}
          {step === "confirm-unmatched" && (
            <Button type="button" variant="gold" onClick={runImport} disabled={!allResolved}>
              Confirmar e importar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
