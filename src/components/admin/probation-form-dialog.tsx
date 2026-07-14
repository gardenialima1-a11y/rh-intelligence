"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { probationFormSchema, type ProbationFormValues, PROBATION_STATUS_OPTIONS } from "@/lib/validation/probation";
import { upsertProbationTracking } from "@/actions/probation";

const STATUS_LABEL: Record<string, string> = {
  EM_AVALIACAO: "Em avaliação",
  APROVADO: "Aprovado",
  REPROVADO: "Reprovado",
};

interface ProbationFormDialogProps {
  employeeId: string;
  employeeName: string;
  managerName?: string | null;
  defaultValues?: Partial<ProbationFormValues>;
}

export function ProbationFormDialog({ employeeId, employeeName, managerName, defaultValues }: ProbationFormDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ProbationFormValues>({
    resolver: zodResolver(probationFormSchema),
    defaultValues: defaultValues ?? { status30: "EM_AVALIACAO", status60: "EM_AVALIACAO", avaliador: managerName ?? null },
  });

  async function onSubmit(values: ProbationFormValues) {
    setServerError(null);
    setLoading(true);
    const result = await upsertProbationTracking(employeeId, values);
    setLoading(false);
    if (!result.success) {
      setServerError(result.error ?? "Não foi possível salvar.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-3.5 w-3.5" /> Avaliar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Período de experiência — {employeeName}</DialogTitle>
          <DialogDescription>Registre o avaliador e a decisão de cada checkpoint (30 e 90 dias).</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="avaliador">Avaliador</Label>
            <Input id="avaliador" placeholder="Nome de quem está avaliando" {...register("avaliador")} />
            <p className="text-[11px] text-muted-foreground">
              Já vem preenchido com o gestor imediato do colaborador — troque se outra pessoa for avaliar.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Checkpoint 30 dias</Label>
            <Controller
              control={control}
              name="status30"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROBATION_STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Checkpoint final (90 dias)</Label>
            <Controller
              control={control}
              name="status60"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROBATION_STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" rows={4} placeholder="Feedback, pontos de atenção..." {...register("notes")} />
          </div>

          {errors.avaliador && <p className="text-xs text-danger">{errors.avaliador.message}</p>}
          {serverError && <p className="sm:col-span-2 text-sm text-danger">{serverError}</p>}

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
