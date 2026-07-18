import { z } from "zod";

export const COMPLIANCE_TYPES = ["ADVERTENCIA", "SUSPENSAO", "PROCESSO"] as const;

export const complianceFormSchema = z.object({
  employeeId: z.string().min(1, "Selecione o colaborador"),
  type: z.enum(COMPLIANCE_TYPES, { message: "Selecione o tipo" }),
  date: z.string().min(1, "Informe a data"),
  motivo: z.string().trim().min(3, "Descreva o motivo (mínimo 3 caracteres)").max(500),
  estimatedCost: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .refine(
      (v) => v === null || v === undefined || v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0),
      "Informe um valor válido"
    ),
});

export type ComplianceFormValues = z.infer<typeof complianceFormSchema>;

export function parseEstimatedCost(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}
