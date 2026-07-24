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
import { formatCurrency } from "@/lib/utils";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { extractOvertimePdf, confirmOvertimePdfImport, type PdfPreviewRow } from "@/actions/overtime-pdf-import";

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

export function OvertimePdfImportDialog({ employees }: { employees: { id: string; name: string }[] }) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dateInput, setDateInput] = React.useState("");
  const [rows, setRows] = React.useState<PdfPreviewRow[] | null>(null);
  const [overrides, setOverrides] = React.useState<Record<string, string>>({}); // matricula -> employeeId escolhido manualmente
  const [excluded, setExcluded] = React.useState<Set<string>>(new Set());
  const [result, setResult] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const router = useRouter();

  function reset() {
    setError(null);
    setRows(null);
    setOverrides({});
    setExcluded(new Set());
    setResult(null);
    setDateInput("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFile(file: File) {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const base64 = await fileToBase64(file);
      const res = await extractOvertimePdf(base64);
      if (!res.success) {
        setError(res.error ?? "Não foi possível ler o PDF.");
      } else {
        setRows(res.rows ?? []);
        setDateInput(res.dateInputValue ?? "");
      }
    } catch (err) {
      setError(err instanceof Error ? `Erro ao processar o arquivo: ${err.message}` : "Não foi possível ler o arquivo.");
    }
    setLoading(false);
  }

  async function handleConfirm() {
    if (!rows) return;
    const toImport = rows
      .filter((r) => !excluded.has(r.matricula))
      .map((r) => ({
        employeeId: overrides[r.matricula] ?? r.employeeId,
        matricula: r.matricula,
        nome: r.nome,
        date: dateInput,
        horasExtras: r.horasExtras,
        valorHE: r.valorHE,
      }))
      .filter((r): r is typeof r & { employeeId: string } => !!r.employeeId);

    if (toImport.length === 0) {
      setError("Nenhum lançamento pronto pra importar (todos sem colaborador vinculado ou excluídos).");
      return;
    }
    setImporting(true);
    setError(null);
    const res = await confirmOvertimePdfImport({ rows: toImport });
    setImporting(false);
    if (!res.success) {
      setError(res.error ?? "Não foi possível importar.");
      return;
    }
    setResult(`${res.importedCount} lançamento(s) importado(s) com sucesso.`);
    setRows(null);
    router.refresh();
  }

  const matchedCount = rows?.filter((r) => (overrides[r.matricula] ?? r.employeeId) && !excluded.has(r.matricula)).length ?? 0;

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
          <FileUp className="h-4 w-4" /> Importar PDF da folha
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar horas extras direto do PDF da folha</DialogTitle>
          <DialogDescription>
            Suba o relatório de folha de pagamento em PDF. O sistema lê as horas extras (verbas 150, 200 e 357) de
            cada colaborador automaticamente — sem precisar reformatar em planilha.
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
                <Label htmlFor="pdf-date">Data do lançamento</Label>
                <Input id="pdf-date" type="date" value={dateInput} onChange={(e) => setDateInput(e.target.value)} />
              </div>
              <p className="text-sm text-muted-foreground">
                {rows.length} colaborador(es) com HE encontrados · {matchedCount} prontos pra importar
              </p>
            </div>

            <div className="max-h-96 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="p-2 text-left">Colaborador (folha)</th>
                    <th className="p-2 text-left">Matrícula</th>
                    <th className="p-2 text-right">Horas</th>
                    <th className="p-2 text-right">Valor</th>
                    <th className="p-2 text-right">R$/h</th>
                    <th className="p-2 text-left">Status</th>
                    <th className="p-2 text-left">Vincular manualmente</th>
                    <th className="p-2 text-center">Incluir</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const isExcluded = excluded.has(r.matricula);
                    const effectiveEmployeeId = overrides[r.matricula] ?? r.employeeId;
                    return (
                      <tr key={r.matricula} className={`border-t border-border ${isExcluded ? "opacity-40" : ""}`}>
                        <td className="p-2">{r.nome}</td>
                        <td className="p-2">{r.matricula}</td>
                        <td className="p-2 text-right">{r.horasExtras.toFixed(2)} h</td>
                        <td className="p-2 text-right">{formatCurrency(r.valorHE)}</td>
                        <td className="p-2 text-right">{r.custoPorHora != null ? formatCurrency(r.custoPorHora) : "—"}</td>
                        <td className="p-2">
                          {!effectiveEmployeeId ? (
                            <span className="flex items-center gap-1 text-danger">
                              <XCircle className="h-3.5 w-3.5" /> Não encontrado
                            </span>
                          ) : r.warning ? (
                            <span className="flex items-center gap-1 text-warning">
                              <AlertTriangle className="h-3.5 w-3.5" /> Confira o R$/h
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
                            disabled={!effectiveEmployeeId}
                            onChange={(e) => {
                              setExcluded((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.delete(r.matricula);
                                else next.add(r.matricula);
                                return next;
                              });
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-muted-foreground">
              O sistema tenta casar cada linha primeiro pela matrícula da folha e, se não achar, pelo nome do
              colaborador já cadastrado. Linhas marcadas &quot;OK (pelo nome)&quot; vieram assim — vale uma conferida rápida.
              Linhas com &quot;Não encontrado&quot; não bateram por nenhum dos dois jeitos (nome pode estar escrito
              diferente, ou o colaborador não está cadastrado ainda) — vincule manualmente ali ou confira o cadastro
              e reimporte depois. Linhas com aviso de R$/h fora do comum vêm destacadas, mas você decide se importa
              mesmo assim.
            </p>
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Fechar
            </Button>
          </DialogClose>
          {rows && (
            <Button type="button" variant="gold" onClick={handleConfirm} disabled={importing || matchedCount === 0}>
              {importing && <Loader2 className="h-4 w-4 animate-spin" />}
              Importar {matchedCount} lançamento(s)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
