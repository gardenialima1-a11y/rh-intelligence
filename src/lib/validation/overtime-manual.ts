import { z } from "zod";

/** Mesmo padrão usado em src/lib/validation/compliance.ts (campo estimatedCost): mantém o valor como string/number no schema — sem z.coerce, que quebra a inferência de tipos do zodResolver com react-hook-form — e valida/converte com as funções abaixo. */
function isValidOptionalNumber(v: unknown) {
  return v === null || v === undefined || v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0);
}

/** Converte um campo numérico opcional do formulário (string vinda do input, número, vazio ou nulo) pro valor final: null quando "não informado". */
export function parseOptionalNumber(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/** Converte um campo numérico obrigatório do formulário (já validado como preenchido e válido) pro número final. */
export function parseRequiredNumber(v: string | number): number {
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

/**
 * Formulário de lançamento manual de hora extra (módulo Jornada). Existe
 * para não depender só da importação de planilha — a Gardenia pode digitar
 * direto quando a planilha vem com cálculo errado ou quando é só um ajuste
 * pontual de um colaborador/dia.
 */
export const manualOvertimeFormSchema = z.object({
  employeeId: z.string().min(1, "Selecione o colaborador"),
  date: z.string().min(1, "Informe a data"),
  overtimeHours: z
    .union([z.string(), z.number()])
    .refine(
      (v) => v !== "" && v !== undefined && v !== null && !Number.isNaN(Number(v)) && Number(v) > 0,
      "Informe as horas extras (maior que zero)"
    ),
  scheduledHours: z.union([z.string(), z.number(), z.null()]).optional().refine(isValidOptionalNumber, "Valor inválido"),
  workedHours: z.union([z.string(), z.number(), z.null()]).optional().refine(isValidOptionalNumber, "Valor inválido"),
  overtimeCost: z.union([z.string(), z.number(), z.null()]).optional().refine(isValidOptionalNumber, "Valor inválido"),
});

export type ManualOvertimeFormValues = z.infer<typeof manualOvertimeFormSchema>;

/** Exclusão em massa de lançamentos de HE por intervalo de datas (e, opcionalmente, um colaborador específico). */
export const overtimeDeleteRangeSchema = z
  .object({
    startDate: z.string().min(1, "Informe a data inicial"),
    endDate: z.string().min(1, "Informe a data final"),
    employeeId: z.string().optional().nullable(),
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: "A data inicial não pode ser depois da data final",
    path: ["endDate"],
  });

export type OvertimeDeleteRangeValues = z.infer<typeof overtimeDeleteRangeSchema>;

/** "YYYY-MM-DD" (vindo do input de data) convertido pra Date em horário local, mesmo padrão usado no parser da importação (parseFolhaDate), pra bater certinho com os registros já salvos. */
export function parseDateInputLocal(raw: string): Date | null {
  const match = raw.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? null : date;
}
