import { z } from "zod";

export const confirmPayrollPdfRowSchema = z.object({
  employeeId: z.string().min(1),
  matricula: z.string(),
  nome: z.string(),
  baseSalary: z.union([z.string(), z.number()]),
  fgtsValue: z.union([z.string(), z.number()]).nullable().optional(),
});

export const confirmPayrollPdfImportSchema = z.object({
  competence: z.string().regex(/^\d{4}-\d{2}$/, "Mês de competência inválido"),
  rows: z.array(confirmPayrollPdfRowSchema).min(1, "Nenhum lançamento para importar"),
});

export type ConfirmPayrollPdfRow = z.infer<typeof confirmPayrollPdfRowSchema>;
