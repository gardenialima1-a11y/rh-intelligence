"use client";

import * as React from "react";
import { Camera, Loader2, X } from "lucide-react";
import { Label } from "@/components/ui/label";

const MAX_DIMENSION = 256;
const JPEG_QUALITY = 0.8;

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

export function PhotoUploadField({
  value,
  onChange,
}: {
  value: string | null | undefined;
  onChange: (dataUrl: string | null) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Envie um arquivo JPG ou PNG.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      onChange(dataUrl);
    } catch {
      setError("Não foi possível processar essa imagem. Tente outra.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label>Foto (opcional)</Label>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-dashed border-border bg-muted text-muted-foreground transition-colors hover:border-gold hover:text-gold-text"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Foto do colaborador" className="h-full w-full object-cover" />
          ) : (
            <Camera className="h-5 w-5" />
          )}
        </button>
        <div className="flex flex-col gap-1">
          <button type="button" onClick={() => inputRef.current?.click()} className="text-left text-[13px] font-medium text-navy underline dark:text-cream">
            {value ? "Trocar foto" : "Enviar foto"}
          </button>
          {value && (
            <button type="button" onClick={() => onChange(null)} className="flex items-center gap-1 text-left text-xs text-muted-foreground hover:text-danger">
              <X className="h-3 w-3" /> Remover
            </button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <p className="text-[11px] text-muted-foreground">JPG ou PNG. A imagem é redimensionada automaticamente.</p>
    </div>
  );
}
