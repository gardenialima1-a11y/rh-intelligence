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
import { validateBulkImportRow, type BulkImportRow, type ReferenceLookups, type RowResult } from "@/lib/validation/bulk-import";
import { bulkImportEmployees, type BulkImportSummary } from "@/actions/employees";

const HEADER_MAP: Record<string, keyof BulkImportRow> = {
  "matrícula": "matricula",
  "matricula": "matricula",
  "nome completo": "nome",
  "nome": "nome",
  "cargo": "cargo",
  "centro de custo": "centroCusto",
  "setor secundário": "setorSecundario",
  "setor secundario": "setorSecundario",
  "gestor": "gestor",
  "unidade": "unidade",
  "gênero": "genero",
  "genero": "genero",
  "telefone": "telefone",
  "e-mail": "email",
  "email": "email",
  "data de nascimento": "dataNascimento",
  "data de admissão": "dataAdmissao",
  "data de admissao": "dataAdmissao",
  "tipo de contrato": "tipoContrato",
  "pcd": "pcd",
  "salário base (r$)": "salario",
  "salario base (r$)": "salario",
  "salário": "salario",
  "salario": "salario",
};

function mapCsvRow(raw: Record<string, string>): BulkImportRow {
  const row: BulkImportRow = {
    matricula: "", nome: "", cargo: "", centroCusto: "", setorSecundario: "", gestor: "", unidade: "",
    genero: "", telefone: "", email: "", dataNascimento: "", dataAdmissao: "", tipoContrato: "", pcd: "", salario: "",
  };
  for (const [key, value] of Object.entries(raw)) {
    const field = HEADER_MAP[key.trim().toLowerCase()];
    if (field) row[field] = (value ?? "").toString().trim();
  }
  return row;
}

export function BulkImportDialog({ refs }: { refs: ReferenceLookups }) {
  const [open, setOpen] = React.useState(false);
  const [results, setResults] = React.useState<RowResult[] | null>(null);
  const [parsing, setParsing] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [summary, setSummary] = React.useState<BulkImportSummary | null>(null);
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

    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (parsed) => {
        setParsing(false);
        if (parsed.data.length === 0) {
          setGlobalError("A planilha está vazia ou não foi possível lê-la.");
          return;
        }
        const rowResults = parsed.data.map((raw, i) => validateBulkImportRow(mapCsvRow(raw), i + 2, refs));
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
    const result = await bulkImportEmployees(results);
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
          <FileSpreadsheet className="h-4 w-4" /> Importar planilha
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar colaboradores por planilha (CSV)</DialogTitle>
          <DialogDescription>
            Use o modelo de planilha fornecido, salve como <strong>CSV</strong> (no Excel: Arquivo → Salvar Como →
            CSV UTF-8) e envie aqui. Cargo, unidade, centro de custo e gestor precisam já existir no cadastro — se
            algum não existir, a linha é sinalizada com o nome exato que falta.
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

            {results && (
              <div className="flex flex-col gap-3">
                <div className="flex gap-4 text-sm">
                  <span className="flex items-center gap-1.5 text-success">
                    <CheckCircle2 className="h-4 w-4" /> {validCount} linha(s) prontas para importar
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
          <div className="flex flex-col gap-3">
            <p className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" /> {summary.created} colaborador(es) importado(s) com sucesso!
            </p>
            {summary.skipped.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="flex items-center gap-2 text-sm text-warning-text">
                  <AlertTriangle className="h-4 w-4" /> {summary.skipped.length} linha(s) não importadas:
                </p>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-border p-2 text-xs text-muted-foreground">
                  {summary.skipped.map((s) => (
                    <p key={s.rowNumber}>
                      Linha {s.rowNumber} ({s.registration}): {s.reason}
                    </p>
                  ))}
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
