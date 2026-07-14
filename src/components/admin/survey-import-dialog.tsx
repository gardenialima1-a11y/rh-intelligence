"use client";

import * as React from "react";
import Papa from "papaparse";
import { useRouter } from "next/navigation";
import { Upload, Loader2, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { detectLikertColumns } from "@/lib/validation/survey-import";
import { importSurveyCycle, type SurveyImportSummary } from "@/actions/survey-import";

const NONE = "__none__";

export function SurveyImportDialog() {
  const [open, setOpen] = React.useState(false);
  const [rows, setRows] = React.useState<Record<string, string>[] | null>(null);
  const [headers, setHeaders] = React.useState<string[]>([]);
  const [likertColumns, setLikertColumns] = React.useState<string[]>([]);
  const [areaColumn, setAreaColumn] = React.useState<string>(NONE);
  const [statusColumn, setStatusColumn] = React.useState<string>(NONE);
  const [npsColumn, setNpsColumn] = React.useState<string>(NONE);
  const [cycleName, setCycleName] = React.useState("");
  const [totalInvited, setTotalInvited] = React.useState("");
  const [parsing, setParsing] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<SurveyImportSummary | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const router = useRouter();

  function reset() {
    setRows(null);
    setHeaders([]);
    setLikertColumns([]);
    setAreaColumn(NONE);
    setStatusColumn(NONE);
    setNpsColumn(NONE);
    setCycleName("");
    setTotalInvited("");
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
        const allHeaders = Object.keys(parsed.data[0]);
        const likert = detectLikertColumns(parsed.data, new Set());
        setRows(parsed.data);
        setHeaders(allHeaders);
        setLikertColumns(likert);
        setTotalInvited(String(parsed.data.length));
      },
      error: () => {
        setParsing(false);
        setGlobalError("Não foi possível ler o arquivo. Confirme que é um .csv válido.");
      },
    });
  }

  async function handleImport() {
    if (!rows) return;
    if (!cycleName.trim()) {
      setGlobalError("Informe o nome do ciclo.");
      return;
    }
    setGlobalError(null);
    setSubmitting(true);
    const result = await importSurveyCycle(
      {
        cycleName: cycleName.trim(),
        totalInvited: Number(totalInvited) || rows.length,
        areaColumn: areaColumn === NONE ? null : areaColumn,
        statusColumn: statusColumn === NONE ? null : statusColumn,
        npsColumn: npsColumn === NONE ? null : npsColumn,
        likertColumns: likertColumns.filter((c) => c !== npsColumn),
      },
      rows
    );
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
          <FileSpreadsheet className="h-4 w-4" /> Importar novo ciclo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar ciclo de pesquisa de clima</DialogTitle>
          <DialogDescription>
            Suba o CSV exportado da pesquisa. Perguntas invertidas (nota alta = ruim) precisam já vir invertidas na
            planilha antes de subir — o sistema não identifica isso sozinho.
          </DialogDescription>
        </DialogHeader>

        {!summary && (
          <div className="flex flex-col gap-4">
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <p className="sm:col-span-2 text-xs text-success">
                  {rows.length} linha(s) lidas · {likertColumns.length} pergunta(s) de escala reconhecidas automaticamente.
                </p>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cycleName">Nome do ciclo</Label>
                  <Input id="cycleName" placeholder="Ex.: PCO 2027-S1" value={cycleName} onChange={(e) => setCycleName(e.target.value)} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="totalInvited">Total de convidados</Label>
                  <Input id="totalInvited" type="number" value={totalInvited} onChange={(e) => setTotalInvited(e.target.value)} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Coluna de área/setor (opcional)</Label>
                  <Select value={areaColumn} onValueChange={setAreaColumn}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Nenhuma</SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Coluna de status (opcional)</Label>
                  <Select value={statusColumn} onValueChange={setStatusColumn}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Nenhuma (usar todas as linhas)</SelectItem>
                      {headers.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">Se marcada, só entram linhas com status &quot;Concluído&quot;.</p>
                </div>

                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label>Coluna da pergunta de eNPS — 0 a 10 (opcional)</Label>
                  <Select value={npsColumn} onValueChange={setNpsColumn}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Nenhuma</SelectItem>
                      {likertColumns.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        )}

        {summary && (
          <p className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" /> Ciclo importado: {summary.respondentsCounted} respondente(s), {summary.responsesCreated} resposta(s) no total.
          </p>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">{summary ? "Fechar" : "Cancelar"}</Button>
          </DialogClose>
          {!summary && (
            <Button type="button" variant="gold" onClick={handleImport} disabled={!rows || submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Importar ciclo
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
