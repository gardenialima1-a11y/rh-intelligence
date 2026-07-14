import { z } from "zod";

export const inssLeaveFormSchema = z.object({
  employeeId: z.string().min(1, "Selecione o colaborador"),
  cid: z.string().trim().min(2, "Informe o CID"),
  startDate: z.string().min(1, "Informe a data de saída"),
  expectedReturnDate: z.string().optional().nullable(),
  actualReturnDate: z.string().optional().nullable(),
  notes: z.string().trim().max(4000, "Máximo de 4000 caracteres").optional().nullable(),
});

export type InssLeaveFormValues = z.infer<typeof inssLeaveFormSchema>;
