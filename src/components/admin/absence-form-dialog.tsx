"use client";

import * as React from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
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
import { AttachmentUploadField } from "@/components/admin/attachment-upload-field";
import {
  absenceFormSchema,
  type AbsenceFormValues,
  ABSENCE_TYPES,
  ABSENCE_TYPE_LABEL,
  DEFAULT_DAILY_HOURS,
  addDaysToDateString,
} from "@/lib/validation/absence";
import { createAbsence, updateAbsence } from "@/actions/absences";
import { lookupCid } from "@/lib/cid-database";

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
    setValue,
    formState: { errors },
  } = useForm<AbsenceFormValues>({
    resolver: zodResolver(absenceFormSchema),
    defaultValues: defaultValues ?? {
      date: new Date().toISOString().slice(0, 10),
      absenceType: "UM_DIA_OU_MAIS",
      daysCount: 1,
      hasCertificate: true,
      reasonId: null,
      hoursLost: DEFAULT_DAILY_HOURS,
      attachmentUrl: null,
      attachmentName: null,
    },
  });

  const absenceType = useWatch({ control, name: "absenceType" });
  const startDate = useWatch({ control, name: "date" });
  const daysCount = useWatch({ control, name: "daysCount" });
  const cidValue = useWatch({ control, name: "cid" });
  const attachmentUrl = useWatch({ control, name: "attachmentUrl" });
  const attachmentName = useWatch({ control, name: "attachmentName" });

  const cidMatch = React.useMemo(() => (cidValue ? lookupCid(cidValue) : null), [cidValue]);

  // Recalcula a data de retorno e sugere as horas perdidas sempre que o
  // tipo de ausência, a data de início ou a quantidade de dias mudam.
  React.useEffect(() => {
    if (!startDate) return;
    if (absenceType === "INDETERMINADO") {
      setValue("returnDate", null);
      return;
    }
    if (absenceType === "ALGUMAS_HORAS" || absenceType === "DIA_PARCIAL") {
      setValue("returnDate", startDate);
      return;
    }
    if (absenceType === "UM_DIA_OU_MAIS") {
      const days = Number(daysCount) || 1;
      setValue("returnDate", addDaysToDateString(startDate, days));
      setValue("hoursLost", days * DEFAULT_DAILY_HOURS);
    }
  }, [absenceType, startDate, daysCount, setValue]);

  const returnDate = useWatch({ control, name: "returnDate" });

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

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Tempo ausente</Label>
            <Controller
              control={control}
              name="absenceType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ABSENCE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{ABSENCE_TYPE_LABEL[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="date">Data de início</Label>
            <Input id="date" type="date" {...register("date")} />
            {errors.date && <p className="text-xs text-danger">{errors.date.message}</p>}
          </div>

          {absenceType === "UM_DIA_OU_MAIS" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="daysCount">Quantidade de dias</Label>
              <Input id="daysCount" type="number" step="1" min="1" {...register("daysCount")} />
              {errors.daysCount && <p className="text-xs text-danger">{String(errors.daysCount.message)}</p>}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="hoursLost">Horas perdidas</Label>
            <Input id="hoursLost" type="number" step="1" {...register("hoursLost")} />
            {errors.hoursLost && <p className="text-xs text-danger">{String(errors.hoursLost.message)}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="returnDate">Data de retorno {absenceType !== "INDETERMINADO" && "(calculada)"}</Label>
            {absenceType === "INDETERMINADO" ? (
              <p className="flex h-10 items-center rounded-lg border border-dashed border-border px-3 text-sm text-muted-foreground">
                A definir quando ela retornar
              </p>
            ) : (
              <Input id="returnDate" type="date" value={returnDate ?? ""} onChange={(e) => setValue("returnDate", e.target.value)} />
            )}
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
            {cidValue && (
              <p className="text-xs text-muted-foreground">
                {cidMatch ? <>✅ {cidMatch.code}: {cidMatch.description}</> : "CID não encontrado na nossa base — pode preencher normalmente."}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Controller
              control={control}
              name="hasCertificate"
              render={({ field }) => (
                <Checkbox id="hasCertificate" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
              )}
            />
            <Label htmlFor="hasCertificate" className="cursor-pointer">Possui atestado médico</Label>
          </div>

          <div className="sm:col-span-2">
            <AttachmentUploadField
              value={attachmentUrl}
              fileName={attachmentName}
              onChange={(dataUrl, name) => {
                setValue("attachmentUrl", dataUrl);
                setValue("attachmentName", name);
              }}
            />
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
