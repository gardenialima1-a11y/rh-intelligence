"use client";

import * as React from "react";
import { Plus, Loader2 } from "lucide-react";
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
import type { ActionResult } from "@/actions/employees";

interface QuickAddDialogProps {
  label: string;
  description: string;
  extraFields?: { key: string; label: string; placeholder?: string }[];
  onCreate: (name: string, extra: Record<string, string>) => Promise<ActionResult>;
  onCreated: () => void;
}

export function QuickAddDialog({ label, description, extraFields = [], onCreate, onCreated }: QuickAddDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [extra, setExtra] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    const result = await onCreate(name, extra);
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? "Não foi possível criar.");
      return;
    }
    setName("");
    setExtra({});
    setOpen(false);
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0" aria-label={`Adicionar ${label.toLowerCase()}`}>
          <Plus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar {label.toLowerCase()}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quick-add-name">Nome</Label>
            <Input id="quick-add-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          {extraFields.map((f) => (
            <div key={f.key} className="flex flex-col gap-1.5">
              <Label htmlFor={`quick-add-${f.key}`}>{f.label}</Label>
              <Input
                id={`quick-add-${f.key}`}
                placeholder={f.placeholder}
                value={extra[f.key] ?? ""}
                onChange={(e) => setExtra((prev) => ({ ...prev, [f.key]: e.target.value }))}
              />
            </div>
          ))}
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancelar</Button>
          </DialogClose>
          <Button type="button" variant="gold" onClick={handleSubmit} disabled={loading || name.trim().length < 2}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
