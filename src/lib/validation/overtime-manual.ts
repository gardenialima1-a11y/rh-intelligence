import { z } from "zod";

/** Campo numérico opcional: trata "" (input vazio) como "não informado" em vez de deixar o z.coerce transformar em 0. */
function optionalNonNegativeNumber() {
  return z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().min(0)
  ).optional();
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
  overtimeHours: z.coerce.number().positive("Informe as horas extras (maior que zero)"),
  scheduledHours: optionalNonNegativeNumber(),
  workedHours: optionalNonNegativeNumber(),
  overtimeCost: optionalNonNegativeNumber(),
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
