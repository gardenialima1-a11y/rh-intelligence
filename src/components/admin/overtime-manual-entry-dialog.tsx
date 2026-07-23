"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { manualOvertimeFormSchema, type ManualOvertimeFormValues } from "@/lib/validation/overtime-manual";
import { createManualOvertimeEntry } from "@/actions/overtime-manual";

interface OptionItem {
  id: string;
  name: string;
}

export function OvertimeManualEntryDialog({ employees }: { employees: OptionItem[] }) {
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
  } = useForm<ManualOvertimeFormValues>({
    resolver: zodResolver(manualOvertimeFormSchema),
    defaultValues: { date: new Date().toISOString().slice(0, 10) },
  });

  async function onSubmit(values: ManualOvertimeFormValues) {
    setServerError(null);
    setLoading(true);
    const result = await createManualOvertimeEntry(values);
    setLoading(false);
    if (!result.success) {
      setServerError(result.error ?? "Não foi possível salvar.");
      return;
    }
    setOpen(false);
    reset({ date: new Date().toISOString().slice(0, 10) });
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setServerError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="gold">
          <Plus className="h-4 w-4" /> Lançar hora extra
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Lançar hora extra manualmente</DialogTitle>
          <DialogDescription>
            Se já existir um lançamento pra esse colaborador nessa data (vindo da importação, por exemplo), ele é
            substituído pelos valores digitados aqui.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Colaborador</Label>
            <Controller
              control={control}
              name="employeeId"
              render={({ field }) => (
                <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.employeeId && <p className="text-xs text-danger">{errors.employeeId.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="date">Data</Label>
            <Input id="date" type="date" {...register("date")} />
            {errors.date && <p className="text-xs text-danger">{errors.date.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="overtimeHours">Horas extras</Label>
            <Input id="overtimeHours" type="number" step="0.1" min="0" placeholder="Ex.: 2.5" {...register("overtimeHours")} />
            {errors.overtimeHours && <p className="text-xs text-danger">{errors.overtimeHours.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="scheduledHours">Jornada prevista no dia (h)</Label>
            <Input id="scheduledHours" type="number" step="0.1" min="0" placeholder="Padrão: 8" {...register("scheduledHours")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="workedHours">Horas trabalhadas no dia (opcional)</Label>
            <Input id="workedHours" type="number" step="0.1" min="0" placeholder="Calculado automaticamente" {...register("workedHours")} />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="overtimeCost">Custo da hora extra em R$ (opcional)</Label>
            <Input id="overtimeCost" type="number" step="0.01" min="0" placeholder="Se deixar em branco, é estimado pelo salário-base" {...register("overtimeCost")} />
          </div>

          {serverError && <p className="sm:col-span-2 text-sm text-danger">{serverError}</p>}

          <DialogFooter className="sm:col-span-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" variant="gold" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar lançamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
