import { z } from "zod";

export const absenceFormSchema = z.object({
  employeeId: z.string().min(1, "Selecione o colaborador"),
  date: z.string().min(1, "Informe a data"),
  reasonId: z.string().optional().nullable(),
  cid: z.string().trim().max(20).optional().nullable(),
  hoursLost: z
    .union([z.string(), z.number()])
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0 && Number(v) <= 240, "Informe entre 1 e 240 horas"),
  hasCertificate: z.boolean(),
});

export type AbsenceFormValues = z.infer<typeof absenceFormSchema>;

export function parseHoursLost(v: string | number): number {
  return Number(v);
}
