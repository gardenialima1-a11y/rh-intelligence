import { z } from "zod";

export const ABSENCE_TYPES = ["ALGUMAS_HORAS", "DIA_PARCIAL", "UM_DIA_OU_MAIS", "INDETERMINADO"] as const;

export const ABSENCE_TYPE_LABEL: Record<(typeof ABSENCE_TYPES)[number], string> = {
  ALGUMAS_HORAS: "Algumas horas",
  DIA_PARCIAL: "Dia parcial",
  UM_DIA_OU_MAIS: "1 dia ou mais",
  INDETERMINADO: "Tempo indeterminado",
};

/** Jornada padrão usada só pra sugerir a quantidade de horas — sempre editável. */
export const DEFAULT_DAILY_HOURS = 8;

export const absenceFormSchema = z.object({
  employeeId: z.string().min(1, "Selecione o colaborador"),
  date: z.string().min(1, "Informe a data de início"),
  absenceType: z.enum(ABSENCE_TYPES),
  daysCount: z
    .union([z.string(), z.number(), z.null()])
    .optional()
    .refine((v) => v === null || v === undefined || v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 1), "Informe quantos dias"),
  returnDate: z.string().optional().nullable(),
  reasonId: z.string().optional().nullable(),
  cid: z.string().trim().max(20).optional().nullable(),
  hoursLost: z
    .union([z.string(), z.number()])
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0 && Number(v) <= 2000, "Informe um número de horas válido"),
  hasCertificate: z.boolean(),
  attachmentUrl: z.string().optional().nullable(),
  attachmentName: z.string().optional().nullable(),
});

export type AbsenceFormValues = z.infer<typeof absenceFormSchema>;

export function parseHoursLost(v: string | number): number {
  return Number(v);
}

/** Soma dias corridos a uma data "YYYY-MM-DD" e devolve no mesmo formato. */
export function addDaysToDateString(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
