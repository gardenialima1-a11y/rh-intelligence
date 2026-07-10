import { z } from "zod";

export const VACANCY_STATUS_OPTIONS = ["ABERTA", "EM_ANDAMENTO", "PREENCHIDA", "CANCELADA", "EM_PAUSA"] as const;

export const vacancyFormSchema = z.object({
  title: z.string().trim().min(2, "Informe o título da vaga"),
  positionId: z.string().optional().nullable(),
  unitId: z.string().optional().nullable(),
  status: z.enum(VACANCY_STATUS_OPTIONS),
  isCritical: z.boolean(),
  targetDays: z
    .union([z.string(), z.number()])
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 1 && Number(v) <= 365, "Informe entre 1 e 365 dias"),
  openedAt: z.string().min(1, "Informe a data de abertura"),
  closedAt: z.string().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export type VacancyFormValues = z.infer<typeof vacancyFormSchema>;

/** Converte o valor bruto do campo de meta de dias (string do input ou número) para number. */
export function parseTargetDays(v: string | number): number {
  return Number(v);
}
