"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
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
import { upsertSalaryBenchmark } from "@/actions/salary-benchmark";

interface EditBenchmarkDialogProps {
  positionId: string;
  positionName: string;
  defaultValues?: {
    region?: string;
    industry?: string;
    marketMinSalary?: number;
    marketAvgSalary?: number;
    marketMaxSalary?: number;
    source?: string;
    referenceDate?: string;
  };
}

export function EditBenchmarkDialog({ positionId, positionName, defaultValues }: EditBenchmarkDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
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
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-3.5 w-3.5" /> {defaultValues?.marketAvgSalary ? "Editar" : "Cadastrar"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Benchmark de mercado — {positionName}</DialogTitle>
          <DialogDescription>
            Insira os valores de uma pesquisa de mercado (Glassdoor, Indeed, Catho, Mercer...). Isso não é uma integração
            ao vivo — atualize aqui sempre que tiver uma pesquisa nova.
          </DialogDescription>
        </DialogHeader>

        <form action={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="region">Região</Label>
            <Input id="region" name="region" defaultValue={defaultValues?.region ?? "Fortaleza, CE"} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="industry">Setor</Label>
            <Input id="industry" name="industry" defaultValue={defaultValues?.industry ?? "Indústria de Alimentos"} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="marketMinSalary">Mínimo (R$)</Label>
            <Input id="marketMinSalary" name="marketMinSalary" type="number" step="0.01" defaultValue={defaultValues?.marketMinSalary} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="marketAvgSalary">Médio (R$)</Label>
            <Input id="marketAvgSalary" name="marketAvgSalary" type="number" step="0.01" defaultValue={defaultValues?.marketAvgSalary} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="marketMaxSalary">Máximo (R$)</Label>
            <Input id="marketMaxSalary" name="marketMaxSalary" type="number" step="0.01" defaultValue={defaultValues?.marketMaxSalary} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="referenceDate">Data da pesquisa</Label>
            <Input id="referenceDate" name="referenceDate" type="date" defaultValue={defaultValues?.referenceDate} />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="source">Fonte</Label>
            <Input id="source" name="source" placeholder="Ex.: Glassdoor, Indeed, Catho, Mercer..." defaultValue={defaultValues?.source} />
          </div>

          {error && <p className="sm:col-span-2 text-sm text-danger">{error}</p>}

          <DialogFooter className="sm:col-span-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" variant="gold" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
