"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, FileUp, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { extractPayrollCostsPdf, confirmPayrollPdfImport, type PayrollPdfPreviewRow } from "@/actions/payroll-pdf-import";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

function currentMonthValue(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function PayrollPdfImportDialog({ employees }: { employees: { id: string; name: string }[] }) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [competence, setCompetence] = React.useState(currentMonthValue());
  const [rows, setRows] = React.useState<PayrollPdfPreviewRow[] | null>(null);
  const [overrides, setOverrides] = React.useState<Record<string, string>>({}); // matricula -> employeeId escolhido manualmente
  const [salaryOverrides, setSalaryOverrides] = React.useState<Record<string, string>>({}); // matricula -> salário digitado manualmente
  const [excluded, setExcluded] = React.useState<Set<string>>(new Set());
  const [result, setResult] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const router = useRouter();

  function reset() {
    setError(null);
    setRows(null);
    setOverrides({});
    setSalaryOverrides({});
    setExcluded(new Set());
    setResult(null);
    setCompetence(currentMonthValue());
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFile(file: File) {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const base64 = await fileToBase64(file);
      const res = await extractPayrollCostsPdf(base64);
      if (!res.success) {
        setError(res.error ?? "Não foi possível ler o PDF.");
      } else {
        setRows(res.rows ?? []);
        if (res.competenceInputValue) setCompetence(res.competenceInputValue);
      }
    } catch (err) {
      setError(err instanceof Error ? `Erro ao processar o arquivo: ${err.message}` : "Não foi possível ler o arquivo.");
    }
    setLoading(false);
  }

  function effectiveSalary(r: PayrollPdfPreviewRow): string {
    return salaryOverrides[r.matricula] ?? (r.baseSalary != null ? String(r.baseSalary) : "");
  }

  async function handleConfirm() {
    if (!rows) return;
    if (!competence) {
      setError("Escolha o mês de referência da folha.");
      return;
    }
    const toImport = rows
      .filter((r) => !excluded.has(r.matricula))
      .map((r) => ({
        employeeId: overrides[r.matricula] ?? r.employeeId,
        matricula: r.matricula,
        nome: r.nome,
        baseSalary: effectiveSalary(r),
        fgtsValue: r.fgtsValue,
      }))
      .filter((r): r is typeof r & { employeeId: string } => !!r.employeeId && !!r.baseSalary && Number(r.baseSalary) > 0);

    if (toImport.length === 0) {
      setError("Nenhum lançamento pronto pra importar (falta colaborador vinculado ou salário preenchido).");
      return;
    }
    setImporting(true);
    setError(null);
    const res = await confirmPayrollPdfImport({ competence, rows: toImport });
    setImporting(false);
    if (!res.success) {
      setError(res.error ?? "Não foi possível importar.");
      return;
    }
    setResult(`${res.importedCount} lançamento(s) de custo importado(s) com sucesso.`);
    setRows(null);
    router.refresh();
  }

  const readyCount =
    rows?.filter((r) => (overrides[r.matricula] ?? r.employeeId) && !!effectiveSalary(r) && !excluded.has(r.matricula)).length ?? 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="gold">
          <FileUp className="h-4 w-4" /> Importar PDF da folha
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar custo mensal direto do PDF da folha</DialogTitle>
          <DialogDescription>
            Suba o relatório de folha de pagamento em PDF. O sistema tenta identificar sozinho a linha de
            &quot;Salário Base&quot; de cada colaborador. Confira a prévia abaixo — você pode corrigir o valor ou o
            colaborador vinculado antes de confirmar.
          </DialogDescription>
        </DialogHeader>

        {!rows && !result && (
          <div className="flex flex-col gap-3">
            <Label htmlFor="pdf-file">Arquivo PDF da folha</Label>
            <Input
              id="pdf-file"
              type="file"
              accept="application/pdf"
              ref={fileInputRef}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
              disabled={loading}
            />
            {loading && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Lendo o PDF, isso pode levar alguns segundos para folhas
                grandes...
              </p>
            )}
          </div>
        )}

        {error && (
          <p className="flex items-center gap-2 text-sm text-danger">
            <AlertTriangle className="h-4 w-4" /> {error}
          </p>
        )}

        {result && (
          <p className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" /> {result}
          </p>
        )}

        {rows && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pdf-competence">Mês de referência da folha</Label>
                <input
                  id="pdf-competence"
                  type="month"
                  value={competence}
                  onChange={(e) => setCompetence(e.target.value)}
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {rows.length} colaborador(es) encontrados · {readyCount} prontos pra importar
              </p>
            </div>

            <div className="max-h-96 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left">Colaborador (folha)</th>
                    <th className="p-2 text-left">Matrícula</th>
                    <th className="p-2 text-right">Salário base</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">Vincular manualmente</th>
                    <th className="p-2 text-center">Incluir</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const isExcluded = excluded.has(r.matricula);
                    const effectiveEmployeeId = overrides[r.matricula] ?? r.employeeId;
                    const salaryNotDetected = r.baseSalary === null && !salaryOverrides[r.matricula];
                    return (
                      <tr key={r.matricula} className={`border-t border-border ${isExcluded ? "opacity-40" : ""}`}>
                        <td className="p-2">{r.nome}</td>
                        <td className="p-2">{r.matricula}</td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={effectiveSalary(r)}
                            onChange={(e) => setSalaryOverrides((prev) => ({ ...prev, [r.matricula]: e.target.value }))}
                            placeholder="Digite o valor"
                            className={`h-8 w-28 rounded-md border px-2 text-right text-sm ${
                              salaryNotDetected ? "border-danger" : "border-border"
                            }`}
                          />
                        </td>
                        <td className="p-2">
                          {!effectiveEmployeeId ? (
                            <span className="flex items-center gap-1 text-danger">
                              <XCircle className="h-3.5 w-3.5" /> Não encontrado
                            </span>
                          ) : salaryNotDetected ? (
                            <span className="flex items-center gap-1 text-warning">
                              <AlertTriangle className="h-3.5 w-3.5" /> Sem salário — preencha
                            </span>
                          ) : r.matchType === "name" && !overrides[r.matricula] ? (
                            <span className="flex items-center gap-1 text-warning" title="Matrícula não bateu, vinculado pelo nome do cadastro">
                              <CheckCircle2 className="h-3.5 w-3.5" /> OK (pelo nome)
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-success">
                              <CheckCircle2 className="h-3.5 w-3.5" /> OK
                            </span>
                          )}
                        </td>
                        <td className="p-2">
                          {!r.employeeId && (
                            <Select
                              value={overrides[r.matricula] ?? undefined}
                              onValueChange={(v) => setOverrides((prev) => ({ ...prev, [r.matricula]: v }))}
                            >
                              <SelectTrigger className="h-8 w-48"><SelectValue placeholder="Selecionar colaborador" /></SelectTrigger>
                              <SelectContent>
                                {employees.map((e) => (
                                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          <input
                            type="checkbox"
                            checked={!isExcluded}
                            onChange={(e) =>
                              setExcluded((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.delete(r.matricula);
                                else next.add(r.matricula);
                                return next;
                              })
                            }
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">{result ? "Fechar" : "Cancelar"}</Button>
          </DialogClose>
          {rows && !result && (
            <Button type="button" variant="gold" onClick={handleConfirm} disabled={importing || readyCount === 0}>
              {importing && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar importação ({readyCount})
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
