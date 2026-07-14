"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
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
import { inssLeaveFormSchema, type InssLeaveFormValues } from "@/lib/validation/inss-leave";
import { createInssLeave, updateInssLeave } from "@/actions/inss-leave";

interface OptionItem {
  id: string;
  name: string;
}

interface InssLeaveFormDialogProps {
  employees: OptionItem[];
  mode: "create" | "edit";
  leaveId?: string;
  defaultValues?: Partial<InssLeaveFormValues>;
  trigger?: React.ReactNode;
}

export function InssLeaveFormDialog({ employees, mode, leaveId, defaultValues, trigger }: InssLeaveFormDialogProps) {
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
  } = useForm<InssLeaveFormValues>({
    resolver: zodResolver(inssLeaveFormSchema),
    defaultValues: defaultValues ?? { startDate: new Date().toISOString().slice(0, 10) },
  });

  async function onSubmit(values: InssLeaveFormValues) {
    setServerError(null);
    setLoading(true);
    const result = mode === "create" ? await createInssLeave(values) : await updateInssLeave(leaveId!, values);
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
            <Plus className="h-4 w-4" /> Novo afastamento
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Novo afastamento INSS" : "Editar afastamento"}</DialogTitle>
          <DialogDescription>Registre o afastamento e vá atualizando as observações ao longo do tempo.</DialogDescription>
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
            <Label htmlFor="cid">CID</Label>
            <Input id="cid" placeholder="Ex.: M54" {...register("cid")} />
            {errors.cid && <p className="text-xs text-danger">{errors.cid.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="startDate">Data de saída</Label>
            <Input id="startDate" type="date" {...register("startDate")} />
            {errors.startDate && <p className="text-xs text-danger">{errors.startDate.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="expectedReturnDate">Previsão de retorno (opcional)</Label>
            <Input id="expectedReturnDate" type="date" {...register("expectedReturnDate")} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="actualReturnDate">Retorno efetivo (se já voltou)</Label>
            <Input id="actualReturnDate" type="date" {...register("actualReturnDate")} />
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" rows={4} placeholder="Vá atualizando aqui conforme houver novidades..." {...register("notes")} />
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
