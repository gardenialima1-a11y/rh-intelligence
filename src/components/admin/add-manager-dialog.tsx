"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus2 } from "lucide-react";
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
import { createManager } from "@/actions/reference-data";
import { MAIN_AREAS } from "@/lib/constants";

interface ManagerOption {
  id: string;
  name: string;
  area: string;
}

interface EmployeeOption {
  id: string;
  name: string;
}

export function AddManagerDialog({
  managers,
  employees,
  trigger,
}: {
  managers: ManagerOption[];
  employees: EmployeeOption[];
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [area, setArea] = React.useState("");
  const [reportsToId, setReportsToId] = React.useState<string | undefined>(undefined);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    const result = await createManager(name, area, reportsToId);
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? "Não foi possível criar.");
      return;
    }
    setName("");
    setArea("");
    setReportsToId(undefined);
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="gold">
            <UserPlus2 className="h-4 w-4" /> Adicionar gestor
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar gestor</DialogTitle>
          <DialogDescription>Defina o nome, a área e, se houver, a quem esse gestor se reporta.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="manager-name">Nome</Label>
            <Select value={name || undefined} onValueChange={setName}>
              <SelectTrigger id="manager-name"><SelectValue placeholder="Selecione o colaborador" /></SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="manager-area">Área</Label>
            <Select value={area || undefined} onValueChange={setArea}>
              <SelectTrigger id="manager-area"><SelectValue placeholder="Selecione a área" /></SelectTrigger>
              <SelectContent>
                {MAIN_AREAS.map((a) => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Reporta para (opcional)</Label>
            <Select value={reportsToId} onValueChange={setReportsToId}>
              <SelectTrigger><SelectValue placeholder="Ninguém (topo da hierarquia)" /></SelectTrigger>
              <SelectContent>
                {managers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name} — {m.area}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Cancelar</Button>
          </DialogClose>
          <Button type="button" variant="gold" onClick={handleSubmit} disabled={loading || name.trim().length < 2 || !area}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
