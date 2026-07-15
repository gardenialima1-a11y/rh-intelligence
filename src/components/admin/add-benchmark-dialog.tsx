"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
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
import { upsertSalaryBenchmark } from "@/actions/salary-benchmark";

interface AddBenchmarkDialogProps {
  positions: { id: string; name: string }[];
}

export function AddBenchmarkDialog({ positions }: AddBenchmarkDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [positionId, setPositionId] = React.useState<string | undefined>(undefined);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    if (!positionId) {
      setError("Selecione o cargo.");
      return;
    }
    setError(null);
    setLoading(true);
    const result = await upsertSalaryBenchmark({
      positionId,
      region: formData.get("region"),
      industry: formData.get("industry"),
      marketMinSalary: formData.get("marketMinSalary"),
      marketAvgSalary: formData.get("marketAvgSalary"),
      marketMaxSalary: formData.get("marketMaxSalary"),
      source: formData.get("source"),
      referenceDate: formData.get("referenceDate"),
    });
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? "Não foi possível salvar.");
      return;
    }
    setOpen(false);
    setPositionId(undefined);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="gold">
          <Plus className="h-4 w-4" /> Adicionar cargo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar cargo ao benchmarking</DialogTitle>
          <DialogDescription>
            Escolha o cargo real e informe os valores de mercado pesquisados (Glassdoor, Indeed, Catho, Mercer...).
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Cargo</Label>
            <Select value={positionId} onValueChange={setPositionId}>
              <SelectTrigger><SelectValue placeholder="Selecione o cargo" /></SelectTrigger>
              <SelectContent>
                {positions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {positions.length === 0 && (
              <p className="text-xs text-muted-foreground">Todos os cargos já têm uma referência cadastrada.</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="region">Região</Label>
            <Input id="region" name="region" defaultValue="Fortaleza, CE" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="industry">Setor</Label>
            <Input id="industry" name="industry" defaultValue="Indústria de Alimentos" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="marketMinSalary">Mínimo (R$)</Label>
            <Input id="marketMinSalary" name="marketMinSalary" type="number" step="0.01" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="marketAvgSalary">Médio (R$)</Label>
            <Input id="marketAvgSalary" name="marketAvgSalary" type="number" step="0.01" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="marketMaxSalary">Máximo (R$)</Label>
            <Input id="marketMaxSalary" name="marketMaxSalary" type="number" step="0.01" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="referenceDate">Data da pesquisa</Label>
            <Input id="referenceDate" name="referenceDate" type="date" />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="source">Fonte</Label>
            <Input id="source" name="source" placeholder="Ex.: Glassdoor, Indeed, Catho, Mercer..." />
          </div>

          {error && <p className="sm:col-span-2 text-sm text-danger">{error}</p>}

          <DialogFooter className="sm:col-span-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" variant="gold" disabled={loading || !positionId}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
