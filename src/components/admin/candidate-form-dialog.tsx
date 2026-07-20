"use client";

import * as React from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
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
import { candidateFormSchema, type CandidateFormValues, FUNNEL_STAGE_OPTIONS } from "@/lib/validation/candidate";
import { createCandidate, updateCandidate } from "@/actions/candidates";

const STAGE_LABEL: Record<string, string> = {
  TRIAGEM: "Triagem",
  ENTREVISTA_RH: "Entrevista RH",
  ENTREVISTA_GESTOR: "Entrevista Gestor",
  TESTE: "Teste",
  PROPOSTA: "Proposta",
  CONTRATADO: "Contratado",
  REPROVADO: "Reprovado",
};

interface VacancyOption {
  id: string;
  title: string;
}

interface CandidateFormDialogProps {
  vacancies: VacancyOption[];
  mode: "create" | "edit";
  candidateId?: string;
  defaultValues?: Partial<CandidateFormValues>;
  trigger?: React.ReactNode;
}

export function CandidateFormDialog({ vacancies, mode, candidateId, defaultValues, trigger }: CandidateFormDialogProps) {
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
  } = useForm<CandidateFormValues>({
    resolver: zodResolver(candidateFormSchema),
    defaultValues: defaultValues ?? { stage: "TRIAGEM" },
  });

  const selectedStage = useWatch({ control, name: "stage" });

  async function onSubmit(values: CandidateFormValues) {
    setServerError(null);
    setLoading(true);
    const result = mode === "create" ? await createCandidate(values) : await updateCandidate(candidateId!, values);
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
            <Plus className="h-4 w-4" /> Novo candidato
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Novo candidato" : "Editar candidato"}</DialogTitle>
          <DialogDescription>Cadastre o candidato vinculado a uma vaga já existente.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nome do candidato</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-xs text-danger">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Vaga</Label>
            <Controller
              control={control}
              name="vacancyId"
              render={({ field }) => (
                <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione a vaga" /></SelectTrigger>
                  <SelectContent>
                    {vacancies.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.vacancyId && <p className="text-xs text-danger">{errors.vacancyId.message}</p>}
            {vacancies.length === 0 && (
              <p className="text-xs text-warning-text">Nenhuma vaga cadastrada ainda — cadastre uma vaga primeiro na aba Operacional.</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="source">Origem</Label>
            <Input id="source" placeholder="Ex.: LinkedIn, Indicação, Site" {...register("source")} />
            {errors.source && <p className="text-xs text-danger">{errors.source.message}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Etapa do processo</Label>
            <Controller
              control={control}
              name="stage"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FUNNEL_STAGE_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{STAGE_LABEL[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {selectedStage === "REPROVADO" && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rejectionReason">Motivo da reprovação</Label>
              <Textarea
                id="rejectionReason"
                placeholder="Explique por que o candidato foi reprovado nesta etapa"
                rows={3}
                {...register("rejectionReason")}
              />
              {errors.rejectionReason && <p className="text-xs text-danger">{errors.rejectionReason.message}</p>}
            </div>
          )}

          {serverError && <p className="text-sm text-danger">{serverError}</p>}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button type="submit" variant="gold" disabled={loading || vacancies.length === 0}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === "create" ? "Cadastrar" : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
