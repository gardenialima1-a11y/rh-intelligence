"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FolderUp, Loader2, CheckCircle2, AlertTriangle, ImageOff } from "lucide-react";
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
import { matchPhotoFileName, type EmployeeForMatch, type PhotoMatchResult } from "@/lib/validation/bulk-photo-match";
import { bulkUpdatePhotos, getEmployeesForPhotoMatch, type BulkPhotoSummary } from "@/actions/bulk-photos";

const MAX_DIMENSION = 320;
const JPEG_QUALITY = 0.8;
const VALID_TYPES = ["image/jpeg", "image/png", "image/webp"];

function resizeImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Arquivo de imagem inválido."));
      img.onload = () => {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Não foi possível processar a imagem."));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

interface MatchedPhoto extends PhotoMatchResult {
  dataUrl: string;
}

export function BulkPhotoUploadDialog() {
  const [open, setOpen] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const [progress, setProgress] = React.useState({ done: 0, total: 0 });
  const [matched, setMatched] = React.useState<MatchedPhoto[]>([]);
  const [unmatched, setUnmatched] = React.useState<PhotoMatchResult[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [summary, setSummary] = React.useState<BulkPhotoSummary | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const router = useRouter();

  React.useEffect(() => {
    if (inputRef.current) {
      inputRef.current.setAttribute("webkitdirectory", "true");
      inputRef.current.setAttribute("directory", "true");
    }
  }, []);

  function reset() {
    setMatched([]);
    setUnmatched([]);
    setError(null);
    setSummary(null);
  }

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).filter((f) => VALID_TYPES.includes(f.type));
    e.target.value = "";
    if (files.length === 0) {
      setError("Nenhuma imagem JPG/PNG/WEBP encontrada nessa pasta.");
      return;
    }

    reset();
    setProcessing(true);
    setProgress({ done: 0, total: files.length });

    const employees: EmployeeForMatch[] = await getEmployeesForPhotoMatch();

    const matchedResults: MatchedPhoto[] = [];
    const unmatchedResults: PhotoMatchResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const match = matchPhotoFileName(file.name, employees);
      if (match.employeeId) {
        try {
          const dataUrl = await resizeImageToDataUrl(file);
          matchedResults.push({ ...match, dataUrl });
        } catch {
          unmatchedResults.push(match);
        }
      } else {
        unmatchedResults.push(match);
      }
      setProgress({ done: i + 1, total: files.length });
    }

    setMatched(matchedResults);
    setUnmatched(unmatchedResults);
    setProcessing(false);
  }

  async function handleSave() {
    if (matched.length === 0) return;
    setSubmitting(true);
    const result = await bulkUpdatePhotos(matched.map((m) => ({ employeeId: m.employeeId!, photoUrl: m.dataUrl })));
    setSubmitting(false);
    if (!result.success) {
      setError(result.error ?? "Erro ao salvar.");
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
          <FolderUp className="h-4 w-4" /> Importar fotos em lote
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar fotos em lote</DialogTitle>
          <DialogDescription>
            Selecione a pasta com as fotos. Cada arquivo precisa se chamar igual à <strong>matrícula</strong> (ex.:
            &quot;1105.jpg&quot;) ou ao <strong>nome completo</strong> do colaborador (ex.: &quot;Abraham Lincol
            Rodrigues da Silva.jpg&quot;) — o sistema casa automaticamente.
          </DialogDescription>
        </DialogHeader>

        {!summary && (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground transition-colors hover:border-gold hover:text-gold-text"
              disabled={processing}
            >
              {processing ? <Loader2 className="h-6 w-6 animate-spin" /> : <FolderUp className="h-6 w-6" />}
              {processing ? `Processando ${progress.done} de ${progress.total}...` : "Clique para escolher a pasta de fotos"}
            </button>
            <input ref={inputRef} type="file" multiple className="hidden" onChange={handleFiles} />

            {error && <p className="text-sm text-danger">{error}</p>}

            {(matched.length > 0 || unmatched.length > 0) && (
              <div className="flex flex-col gap-3">
                <div className="flex gap-4 text-sm">
                  <span className="flex items-center gap-1.5 text-success">
                    <CheckCircle2 className="h-4 w-4" /> {matched.length} foto(s) reconhecidas
                  </span>
                  {unmatched.length > 0 && (
                    <span className="flex items-center gap-1.5 text-warning-text">
                      <AlertTriangle className="h-4 w-4" /> {unmatched.length} sem colaborador correspondente
                    </span>
                  )}
                </div>

                {matched.length > 0 && (
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Foto</TableHead>
                          <TableHead>Arquivo</TableHead>
                          <TableHead>Colaborador</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {matched.map((m, i) => (
                          <TableRow key={i}>
                            <TableCell>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={m.dataUrl} alt={m.employeeName ?? ""} className="h-8 w-8 rounded-full object-cover" />
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{m.fileName}</TableCell>
                            <TableCell>{m.employeeName}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {unmatched.length > 0 && (
                  <div className="max-h-32 overflow-y-auto rounded-lg border border-border p-2">
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                      <ImageOff className="h-3.5 w-3.5" /> Arquivos sem correspondência (renomeie e suba de novo, se quiser):
                    </p>
                    {unmatched.map((u, i) => (
                      <p key={i} className="text-xs text-muted-foreground">{u.fileName}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {summary && (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" /> {summary.updated} foto(s) salva(s) com sucesso!
            </p>
            {summary.failed.length > 0 && (
              <p className="flex items-center gap-2 text-sm text-danger">
                <AlertTriangle className="h-4 w-4" /> {summary.failed.length} não puderam ser salvas.
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">{summary ? "Fechar" : "Cancelar"}</Button>
          </DialogClose>
          {!summary && (
            <Button type="button" variant="gold" onClick={handleSave} disabled={matched.length === 0 || submitting || processing}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar {matched.length > 0 ? `(${matched.length})` : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
