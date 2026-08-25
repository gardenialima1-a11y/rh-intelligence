"use client";

import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2, PhoneCall } from "lucide-react";
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
import {
  candidateActivityFormSchema,
  type CandidateActivityFormValues,
  ACTIVITY_TYPE_OPTIONS,
  ACTIVITY_TYPE_LABEL,
} from "@/lib/validation/candidate-activity";
import { logCandidateActivity } from "@/actions/candidate-activities";

export function LogActivityDialog({
  candidateId,
  candidateName,
  trigger,
}: {
  candidateId: string;
  candidateName: string;
  trigger?: React.ReactNode;
}) {
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
  } = useForm<CandidateActivityFormValues>({
    resolver: zodResolver(candidateActivityFormSchema),
    defaultValues: {
      candidateId,
      type: "TRIAGEM_TELEFONICA",
      occurredAt: new Date().toISOString().slice(0, 10),
      notes: "",
    },
  });

  async function onSubmit(values: CandidateActivityFormValues) {
    setServerError(null);
    setLoading(true);
    const result = await logCandidateActivity({ ...values, candidateId });
    setLoading(false);
    if (!result.success) {
      setServerError(result.error ?? "Não foi possível registrar.");
      return;
    }
    setOpen(false);
    reset({ candidateId, type: "TRIAGEM_TELEFONICA", occurredAt: new Date().toISOString().slice(0, 10), notes: "" });
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <PhoneCall className="h-3.5 w-3.5" /> Registrar contato
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar contato</DialogTitle>
          <DialogDescription>Candidato: {candidateName}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Tipo de contato</Label>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_TYPE_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>{ACTIVITY_TYPE_LABEL[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="occurredAt">Data do contato</Label>
            <Input id="occurredAt" type="date" {...register("occurredAt")} />
            {errors.occurredAt && <p className="text-xs text-danger">{errors.occurredAt.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Observação (opcional)</Label>
            <Textarea id="notes" placeholder="Ex.: combinou de retornar amanhã, disponível a partir de..." rows={3} {...register("notes")} />
          </div>

          {serverError && <p className="text-sm text-danger">{serverError}</p>}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" variant="gold" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
