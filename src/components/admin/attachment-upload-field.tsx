"use client";

import * as React from "react";
import { Paperclip, Loader2, X, FileText } from "lucide-react";
import { Label } from "@/components/ui/label";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/jpg"];

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

export function AttachmentUploadField({
  value,
  fileName,
  onChange,
}: {
  value: string | null | undefined;
  fileName: string | null | undefined;
  onChange: (dataUrl: string | null, fileName: string | null) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Envie um arquivo PDF ou JPG.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("Arquivo muito grande. O limite é 5MB.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      onChange(dataUrl, file.name);
    } catch {
      setError("Não foi possível processar esse arquivo. Tente outro.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label>Anexar atestado (opcional)</Label>
      {value ? (
        <div className="flex items-center gap-2 rounded-lg border border-border p-2 text-sm">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{fileName ?? "Arquivo anexado"}</span>
          <button
            type="button"
            onClick={() => onChange(null, null)}
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-danger"
          >
            <X className="h-3.5 w-3.5" /> Remover
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground transition-colors hover:border-gold hover:text-gold-text"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
          {loading ? "Enviando..." : "Escolher arquivo (PDF ou JPG)"}
        </button>
      )}
      <input ref={inputRef} type="file" accept="application/pdf,image/jpeg" className="hidden" onChange={handleFileChange} />
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
