"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Merge, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { mergeManagers } from "@/actions/reference-data";

interface ManagerOption {
  id: string;
  name: string;
  area: string;
}

export function MergeManagerButton({ manager, allManagers }: { manager: ManagerOption; allManagers: ManagerOption[] }) {
  const [open, setOpen] = useState(false);
  const [keepId, setKeepId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const otherManagers = allManagers.filter((m) => m.id !== manager.id);

  async function handleMerge() {
    if (!keepId) return;
    setError(null);
    setLoading(true);
    const result = await mergeManagers(manager.id, keepId);
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? "Não foi possível mesclar.");
      return;
    }
    setOpen(false);
    setKeepId(undefined);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" title="Mesclar com outro gestor (registro duplicado)">
          <Merge className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mesclar gestor duplicado</DialogTitle>
          <DialogDescription>
            Isso apaga <strong>{manager.name}</strong> e transfere toda a equipe, sub-gestores e hierarquia dele
            para o gestor que você escolher abaixo (o gestor &quot;correto&quot;).
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label>Manter qual gestor? (o correto)</Label>
          <Select value={keepId} onValueChange={setKeepId}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {otherManagers.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name} — {m.area}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancelar</Button>
          </DialogClose>
          <Button type="button" variant="gold" onClick={handleMerge} disabled={loading || !keepId}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Mesclar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
