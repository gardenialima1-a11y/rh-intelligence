import { z } from "zod";

export const GENDER_OPTIONS = ["MASCULINO", "FEMININO", "NAO_INFORMADO"] as const;
export const CONTRACT_TYPE_OPTIONS = ["CLT", "PJ", "APRENDIZ", "ESTAGIO", "TEMPORARIO"] as const;

export const employeeFormSchema = z
  .object({
    registration: z.string().trim().min(1, "Informe a matrícula"),
    name: z.string().trim().min(3, "Informe o nome completo"),
    positionId: z.string().optional().nullable(),
    costCenterId: z.string().optional().nullable(),
    secondaryCostCenterId: z.string().optional().nullable(),
    managerId: z.string().optional().nullable(),
    unitId: z.string().min(1, "Selecione a unidade"),
    gender: z.enum(GENDER_OPTIONS),
    phone: z.string().trim().optional().nullable(),
    email: z.string().trim().email("E-mail inválido").optional().nullable().or(z.literal("")),
    photoUrl: z
      .string()
      .optional()
      .nullable()
      .refine((v) => !v || v.startsWith("data:image/") || v.startsWith("http"), "Foto inválida")
      .refine((v) => !v || v.length < 900_000, "Imagem muito grande — escolha uma foto menor"),
    birthDate: z.string().optional().nullable(),
    admissionDate: z.string().min(1, "Informe a data de admissão"),
    contractType: z.enum(CONTRACT_TYPE_OPTIONS),
    isPCD: z.boolean(),
    baseSalary: z
      .union([z.string(), z.number()])
      .optional()
      .nullable()
      .refine((v) => v === undefined || v === null || v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0), "Salário inválido"),
  })
  .refine(
    (data) => {
      if (!data.birthDate) return true;
      return new Date(data.birthDate) < new Date(data.admissionDate);
    },
    { message: "Data de nascimento deve ser anterior à admissão", path: ["birthDate"] }
  );

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

/** Converte o valor bruto do campo de salário (string do input ou número) para number|null. */
export function parseSalaryValue(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export const terminationFormSchema = z.object({
  terminationDate: z.string().min(1, "Informe a data de desligamento"),
  voluntary: z.boolean(),
  reasonId: z.string().optional().nullable(),
  notes: z.string().trim().max(2000, "Máximo de 2000 caracteres").optional().nullable(),
  costValue: z
    .union([z.string(), z.number()])
    .optional()
    .nullable()
    .refine((v) => v === undefined || v === null || v === "" || (!Number.isNaN(Number(v)) && Number(v) >= 0), "Custo inválido"),
});

export type TerminationFormValues = z.infer<typeof terminationFormSchema>;
