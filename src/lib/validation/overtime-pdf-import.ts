import { z } from "zod";

/** Faixa "razoável" de custo por hora extra — fora disso, a linha é destacada na prévia pra conferência antes de importar. */
export const OVERTIME_HOURLY_RATE_MIN = 8;
export const OVERTIME_HOURLY_RATE_MAX = 80;

export const confirmPdfImportRowSchema = z.object({
  employeeId: z.string().min(1),
  matricula: z.string(),
  nome: z.string(),
  date: z.string().min(1, "Informe a data"),
  horasExtras: z.union([z.string(), z.number()]),
  valorHE: z.union([z.string(), z.number()]),
});

export const confirmPdfImportSchema = z.object({
  rows: z.array(confirmPdfImportRowSchema).min(1, "Nenhum lançamento para importar"),
});

export type ConfirmPdfImportRow = z.infer<typeof confirmPdfImportRowSchema>;
