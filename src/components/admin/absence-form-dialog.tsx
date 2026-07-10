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
import { absenceFormSchema, type AbsenceFormValues } from "@/lib/validation/absence";
import { createAbsence, updateAbsence } from "@/actions/absences";

interface OptionItem {
  id: string;
  name: string;
}
interface ReasonOption {
  id: string;
  label: string;
}

interface AbsenceFormDialogProps {
  employees: OptionItem[];
  reasons: ReasonOption[];
  mode: "create" | "edit";
  absenceId?: string;
  defaultValues?: Partial<AbsenceFormValues>;
  trigger?: React.ReactNode;
}

export function AbsenceFormDialog({ employees, reasons, mode, absenceId, defaultValues, trigger }: AbsenceFormDialogProps) {
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
  } = useForm<AbsenceFormValues>({
    resolver: zodResolver(absenceFormSchema),
    defaultValues: defaultValues ?? {
      date: new Date().toISOString().slice(0, 10),
      hasCertificate: true,
      reasonId: null,
    },
  });

  async function onSubmit(values: AbsenceFormValues) {
    setServerError(null);
    setLoading(true);
    const result = mode === "create" ? await createAbsence(values) : await updateAbsence(absenceId!, values);
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
            <Plus className="h-4 w-4" /> Novo atestado
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Novo atestado" : "Editar atestado"}</DialogTitle>
          <DialogDescription>Registre um afastamento com atestado médico.</DialogDescription>
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
            <Label htmlFor="hoursLost">Horas perdidas</Label>
            <Input id="hoursLost" type="number" step="1" {...register("hoursLost")} />
            {errors.hoursLost && <p className="text-xs text-danger">{String(errors.hoursLost.message)}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Motivo (opcional)</Label>
            <Controller
              control={control}
              name="reasonId"
              render={({ field }) => (
                <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {reasons.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cid">CID (opcional)</Label>
            <Input id="cid" placeholder="Ex.: M54" {...register("cid")} />
          </div>

          <div className="flex items-center gap-2 pt-6 sm:col-span-2">
            <Controller
              control={control}
              name="hasCertificate"
              render={({ field }) => (
                <Checkbox id="hasCertificate" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
              )}
            />
            <Label htmlFor="hasCertificate" className="cursor-pointer">Possui atestado médico</Label>
          </div>

          {serverError && <p className="sm:col-span-2 text-sm text-danger">{serverError}</p>}

          <DialogFooter className="sm:col-span-2">
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" variant="gold" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "create" ? "Cadastrar" : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
