"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2, UserX } from "lucide-react";
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
import { terminationFormSchema, type TerminationFormValues } from "@/lib/validation/employee";
import { deactivateEmployee } from "@/actions/employees";

interface TerminationDialogProps {
  employeeId: string;
  employeeName: string;
  reasons: { id: string; label: string }[];
}

export function TerminationDialog({ employeeId, employeeName, reasons }: TerminationDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<TerminationFormValues>({
    resolver: zodResolver(terminationFormSchema),
    defaultValues: { voluntary: true },
  });

  async function onSubmit(values: TerminationFormValues) {
    setServerError(null);
    setLoading(true);
    const result = await deactivateEmployee(employeeId, values);
    setLoading(false);
    if (!result.success) {
      setServerError(result.error ?? "Não foi possível desligar.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserX className="h-3.5 w-3.5" /> Desligar
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Desligar colaborador</DialogTitle>
          <DialogDescription>{employeeName} será marcado(a) como desligado(a).</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="terminationDate">Data de desligamento</Label>
            <Input id="terminationDate" type="date" {...register("terminationDate")} />
            {errors.terminationDate && <p className="text-xs text-danger">{errors.terminationDate.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Tipo</Label>
            <Controller
              control={control}
              name="voluntary"
              render={({ field }) => (
                <Select value={field.value ? "true" : "false"} onValueChange={(v) => field.onChange(v === "true")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Voluntário</SelectItem>
                    <SelectItem value="false">Involuntário</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Motivo</Label>
            <Controller
              control={control}
              name="reasonId"
              render={({ field }) => (
                <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger>
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
            <Label htmlFor="costValue">Custo rescisório estimado (R$, opcional)</Label>
            <Input id="costValue" type="number" step="0.01" {...register("costValue")} />
          </div>

          {serverError && <p className="text-sm text-danger">{serverError}</p>}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar desligamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
