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
  importAttendanceReport,
  previewUnmatchedNames,
  type AttendanceImportSummary,
} from "@/actions/attendance-import";

const BATCH_SIZE = 250;
const IGNORE_VALUE = "__ignorar__";

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
    comAtestado: 0,
    cursoAprendizagem: 0,
    naoContabilizados: 0,
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
    comAtestado: acc.comAtestado + part.comAtestado,
    cursoAprendizagem: acc.cursoAprendizagem + part.cursoAprendizagem,
    naoContabilizados: acc.naoContabilizados + part.naoContabilizados,
  };
}

async function parseExcelFile(file: File): Promise<Record<string, string>[]> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "", raw: false });
}

type Step = "upload" | "confirm-unmatched" | "importing" | "done";

export function AttendanceImportDialog() {
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState<Step>("upload");
  const [rows, setRows] = React.useState<Record<string, string>[] | null>(null);
  const [parsing, setParsing] = React.useState(false);
  const [checkingMatches, setCheckingMatches] = React.useState(false);
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(null);
  const [globalError, setGlobalError] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<AttendanceImportSummary | null>(null);
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
    let parsedRows: Record<string, string>[] | null = null;

    if (isExcel) {
      try {
        parsedRows = await parseExcelFile(file);
      } catch {
        setParsing(false);
        setGlobalError("Não foi possível ler o arquivo. Confirme que é um .xls/.xlsx válido.");
        return;
      }
    } else {
      parsedRows = await new Promise<Record<string, string>[] | null>((resolve) => {
        Papa.parse<Record<string, string>>(file, {
          header: true,
          skipEmptyLines: true,
          complete: (parsed) => resolve(parsed.data),
          error: () => resolve(null),
        });
      });
      if (!parsedRows) {
        setParsing(false);
        setGlobalError("Não foi possível ler o arquivo. Confirme que é um .csv válido.");
        return;
      }
    }

    if (!parsedRows || parsedRows.length === 0) {
      setParsing(false);
      setGlobalError("A planilha está vazia ou não foi possível lê-la.");
      return;
    }

    setRows(parsedRows);
    setParsing(false);
    setCheckingMatches(true);

    // Manda só código+nome, já deduplicados — não o arquivo inteiro com todas as
    // colunas. Um mês de ponto tem milhares de linhas; mandar tudo pra essa
    // conferência facilmente estourava o limite de tamanho da requisição.
    const seen = new Set<string>();
    const people: { codigo: string; nome: string }[] = [];
    for (const row of parsedRows) {
      const codigo = (row["Código"] ?? "").toString().trim();
      const nome = (row["Nome"] ?? "").toString().trim();
      if (!nome) continue;
      const key = `${codigo}|${nome}`;
      if (seen.has(key)) continue;
      seen.add(key);
      people.push({ codigo, nome });
    }

    const preview = await previewUnmatchedNames(people);
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

    const batches: Record<string, string>[][] = [];
    for (let i = 0; i < rows.length; i += BATCH_SIZE) batches.push(rows.slice(i, i + BATCH_SIZE));

    let acc = emptySummary();
    setProgress({ done: 0, total: rows.length });

    for (const batch of batches) {
      const result = await importAttendanceReport(batch, overrides);
      if (!result.success) {
        setGlobalError(
          `${result.error ?? "Erro ao importar."} (parte do arquivo já foi importada — o que passou não some, é só rodar de novo pra terminar o resto)`
        );
        setSummary(acc.created > 0 ? acc : null);
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
          <FileSpreadsheet className="h-4 w-4" /> Importar relatório de ponto
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar relatório de ponto</DialogTitle>
          <DialogDescription>
            Suba o relatório de ponto direto em <strong>.xls, .xlsx ou .csv</strong> — não precisa mais converter.
            O sistema reconhece as colunas Dia, Nome, Código, Rotina Esperada, Obs, Entrada/Saída, Horário Esperado e
            Duração automaticamente: calcula quem faltou, atualiza a jornada esperada/trabalhada de cada dia (base
            da taxa de absenteísmo), registra as ausências (identificando atestado/declaração/licença) e marca
            sozinho quem é Cargo de Confiança.
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
              {parsing ? "Lendo relatório..." : checkingMatches ? "Conferindo colaboradores do cadastro..." : "Clique para escolher o arquivo .xls, .xlsx ou .csv"}
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
                <CheckCircle2 className="h-4 w-4" /> {rows.length} linha(s) prontas para importar
                {rows.length > BATCH_SIZE ? ` (em lotes de ${BATCH_SIZE})` : ""}. Todos os nomes bateram com o cadastro.
              </p>
            )}
          </div>
        )}

        {step === "confirm-unmatched" && (
          <div className="flex flex-col gap-3">
            <p className="flex items-center gap-2 text-sm text-warning-text">
              <AlertTriangle className="h-4 w-4" /> {unmatchedNames.length} nome(s) do arquivo não bateram com
              ninguém do cadastro (só comparando pelo nome). Escolha o colaborador certo pra cada um, ou marque
              &quot;Ignorar&quot; pra deixar esse nome de fora da importação.
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
                Importando {progress?.done ?? 0} de {progress?.total ?? 0} linhas...
              </p>
            )}
          </div>
        )}

        {step === "done" && summary && (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" /> {summary.created} registro(s) processados.
            </p>
            <p className="text-xs text-muted-foreground">
              {summary.faltas} falta(s) injustificada(s) · {summary.comAtestado} com atestado/declaração/licença ·{" "}
              {summary.ferias} em férias · {summary.cargoConfiancaDetectados} identificado(s) como Cargo de Confiança
            </p>
            <div className="rounded-lg border border-border p-3 text-sm">
              <p className="font-medium">Taxa de absenteísmo atualizada</p>
              <p className="text-muted-foreground">
                {summary.diasComJornadaAtualizada} dia(s)-colaborador com jornada esperada/trabalhada atualizada ·{" "}
                {summary.horasEsperadasTotais} h esperadas · {summary.horasPerdidasTotais} h perdidas ·{" "}
                {summary.ausenciasRegistradas} ausência(s) registrada(s)
              </p>
              <p className="mt-1 text-muted-foreground">
                {summary.naoContabilizados} dia(s)-colaborador fora do cálculo (férias, folga, feriado, sem jornada,
                abono, dispensa ou cargo de confiança) · {summary.cursoAprendizagem} dia(s) em curso/aprendizagem
                (contados como cumpridos)
              </p>
            </div>
            {summary.unmatchedNames.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="flex items-center gap-2 text-sm text-warning-text">
                  <AlertTriangle className="h-4 w-4" /> {summary.unmatchedNames.length} linha(s) de nomes ignorados ficaram de fora.
                </p>
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
