"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
import { vacancyFormSchema, type VacancyFormValues, VACANCY_STATUS_OPTIONS } from "@/lib/validation/vacancy";
import { createVacancy, updateVacancy } from "@/actions/vacancies";

const STATUS_LABEL: Record<string, string> = {
  ABERTA: "Aberta",
  EM_ANDAMENTO: "Em andamento",
  PREENCHIDA: "Preenchida",
  CANCELADA: "Cancelada",
  EM_PAUSA: "Em pausa",
};

interface OptionItem {
  id: string;
  name: string;
}

interface VacancyFormDialogProps {
  positions: OptionItem[];
  units: OptionItem[];
  mode: "create" | "edit";
  vacancyId?: string;
  defaultValues?: Partial<VacancyFormValues>;
  trigger?: React.ReactNode;
}

export function VacancyFormDialog({ positions, units, mode, vacancyId, defaultValues, trigger }: VacancyFormDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<VacancyFormValues>({
    resolver: zodResolver(vacancyFormSchema),
    defaultValues: defaultValues ?? {
      status: "ABERTA",
      isCritical: false,
      targetDays: 30,
      openedAt: new Date().toISOString().slice(0, 10),
      positionId: null,
      unitId: null,
    },
  });

  async function onSubmit(values: VacancyFormValues) {
    setServerError(null);
    setLoading(true);
    const result = mode === "create" ? await createVacancy(values) : await updateVacancy(vacancyId!, values);
    setLoading(false);
    if (!result.success) {
      setServerError(result.error ?? "Não foi possível salvar.");
      return;
    }
    setOpen(false);
    reset();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="gold">
            <Plus className="h-4 w-4" /> Nova vaga
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nova vaga" : "Editar vaga"}</DialogTitle>
          <DialogDescription>Cadastre a vaga e acompanhe o SLA de preenchimento.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="title">Título da vaga</Label>
            <Input id="title" placeholder="Ex.: Analista de RH Pleno" {...register("title")} />
            {errors.title && <p className="text-xs text-danger">{errors.title.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Cargo relacionado (opcional)</Label>
            <Controller
              control={control}
              name="positionId"
              render={({ field }) => (
                <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {positions.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Unidade (opcional)</Label>
            <Controller
              control={control}
              name="unitId"
              render={({ field }) => (
                <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {units.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Status</Label>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {VACANCY_STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="targetDays">Meta de SLA (dias)</Label>
            <Input id="targetDays" type="number" {...register("targetDays")} />
            {errors.targetDays && <p className="text-xs text-danger">{errors.targetDays.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="openedAt">Data de abertura</Label>
            <Input id="openedAt" type="date" {...register("openedAt")} />
            {errors.openedAt && <p className="text-xs text-danger">{errors.openedAt.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="closedAt">Data de fechamento (se preenchida)</Label>
            <Input id="closedAt" type="date" {...register("closedAt")} />
          </div>

          <div className="flex items-center gap-2 pt-6">
            <Controller
              control={control}
              name="isCritical"
              render={({ field }) => (
                <Checkbox id="isCritical" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
              )}
            />
            <Label htmlFor="isCritical" className="cursor-pointer">Vaga crítica</Label>
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Input id="notes" placeholder="Detalhes sobre a vaga..." {...register("notes")} />
          </div>

          {serverError && <p className="sm:col-span-2 text-sm text-danger">{serverError}</p>}

          <DialogFooter className="sm:col-span-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" variant="gold" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "create" ? "Cadastrar vaga" : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
