import { z } from "zod";

export const PROBATION_STATUS_OPTIONS = ["EM_AVALIACAO", "APROVADO", "REPROVADO"] as const;

export const probationFormSchema = z.object({
  avaliador: z.string().trim().max(120).optional().nullable(),
  status30: z.enum(PROBATION_STATUS_OPTIONS),
  status60: z.enum(PROBATION_STATUS_OPTIONS),
  notes: z.string().trim().max(4000, "Máximo de 4000 caracteres").optional().nullable(),
});

export type ProbationFormValues = z.infer<typeof probationFormSchema>;
