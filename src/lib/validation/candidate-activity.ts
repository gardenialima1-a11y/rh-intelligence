import { z } from "zod";

export const ACTIVITY_TYPE_OPTIONS = [
  "TRIAGEM_TELEFONICA",
  "ENTREVISTA_RH",
  "ENTREVISTA_GESTOR",
  "TESTE_APLICADO",
  "PROPOSTA_ENVIADA",
  "EMAIL",
  "MENSAGEM",
  "OUTRO",
] as const;

export const ACTIVITY_TYPE_LABEL: Record<(typeof ACTIVITY_TYPE_OPTIONS)[number], string> = {
  TRIAGEM_TELEFONICA: "Ligação de triagem",
  ENTREVISTA_RH: "Entrevista RH",
  ENTREVISTA_GESTOR: "Entrevista com o gestor",
  TESTE_APLICADO: "Teste aplicado",
  PROPOSTA_ENVIADA: "Proposta enviada",
  EMAIL: "E-mail",
  MENSAGEM: "Mensagem (WhatsApp, SMS, etc.)",
  OUTRO: "Outro contato",
};

// Tipos considerados uma "conversa" de verdade (para o indicador "com quantas
// pessoas conversei") — deixa de fora e-mail e mensagem escrita, que não são
// uma conversa ao vivo.
export const CONVERSATION_ACTIVITY_TYPES: (typeof ACTIVITY_TYPE_OPTIONS)[number][] = [
  "TRIAGEM_TELEFONICA",
  "ENTREVISTA_RH",
  "ENTREVISTA_GESTOR",
];

export const candidateActivityFormSchema = z.object({
  candidateId: z.string().min(1, "Selecione o candidato"),
  type: z.enum(ACTIVITY_TYPE_OPTIONS),
  occurredAt: z.string().min(1, "Informe a data do contato"),
  notes: z.string().trim().max(500).optional().nullable(),
});

export type CandidateActivityFormValues = z.infer<typeof candidateActivityFormSchema>;
