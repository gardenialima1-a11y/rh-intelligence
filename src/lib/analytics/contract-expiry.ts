export interface ContractExpiryInput {
  contractEndDate: Date | null;
}

export type ContractExpiryStatus = "sem_data" | "vencido" | "vence_em_30_dias" | "no_prazo";

export interface ContractExpiryResult {
  status: ContractExpiryStatus;
  daysRemaining: number | null;
}

export function classifyContractExpiry(input: ContractExpiryInput, now: Date = new Date()): ContractExpiryResult {
  if (!input.contractEndDate) return { status: "sem_data", daysRemaining: null };

  const daysRemaining = Math.ceil((input.contractEndDate.getTime() - now.getTime()) / 86400000);

  if (daysRemaining < 0) return { status: "vencido", daysRemaining };
  if (daysRemaining <= 30) return { status: "vence_em_30_dias", daysRemaining };
  return { status: "no_prazo", daysRemaining };
}
