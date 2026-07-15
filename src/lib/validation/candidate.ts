import { z } from "zod";

export const FUNNEL_STAGE_OPTIONS = [
  "TRIAGEM",
  "ENTREVISTA_RH",
  "ENTREVISTA_GESTOR",
  "TESTE",
  "PROPOSTA",
  "CONTRATADO",
  "REPROVADO",
] as const;

export const candidateFormSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome do candidato"),
  vacancyId: z.string().min(1, "Selecione a vaga"),
  source: z.string().trim().min(2, "Informe a origem (Ex.: LinkedIn, Indicação)"),
  stage: z.enum(FUNNEL_STAGE_OPTIONS),
});

export type CandidateFormValues = z.infer<typeof candidateFormSchema>;
