import { prisma } from "@/lib/prisma";

const STAGE_ORDER = [
  "TRIAGEM",
  "CADASTRO",
  "ANALISE_CPF",
  "ENTREVISTA_RH",
  "TESTE",
  "PROPOSTA",
  "ADMISSAO",
] as const;

export async function getStageTimeline() {
  const histories = await prisma.candidateStageHistory.findMany({
    select: { stage: true, enteredAt: true, exitedAt: true },
  });

  const durations: Record<string, number[]> = {};
  for (const h of histories) {
    const end = h.exitedAt ?? new Date();
    const days = (end.getTime() - h.enteredAt.getTime()) / (1000 * 60 * 60 * 24);
    if (days < 0) continue;
    if (!durations[h.stage]) durations[h.stage] = [];
    durations[h.stage].push(days);
  }

  return STAGE_ORDER.map((stage) => {
    const list = durations[stage] ?? [];
    const avg = list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0;
    return { stage, avgDays: Math.round(avg * 10) / 10, count: list.length };
  });
}

export async function getSalaDeVagas() {
  const vacancies = await prisma.vacancy.findMany({
    where: { status: { in: ["ABERTA", "EM_ANDAMENTO"] } },
    include: { unit: true },
    orderBy: { openedAt: "asc" },
  });

  const now = Date.now();
  return vacancies.map((v) => {
    const daysOpen = Math.floor((now - v.openedAt.getTime()) / (1000 * 60 * 60 * 24));
    const urgency: "CRITICA" | "ATENCAO" | "OK" =
      daysOpen > v.targetDays ? "CRITICA" : daysOpen > v.targetDays * 0.7 ? "ATENCAO" : "OK";
    return {
      id: v.id,
      title: v.title,
      unit: v.unit?.name ?? null,
      isCritical: v.isCritical,
      daysOpen,
      targetDays: v.targetDays,
      urgency,
    };
  });
}

export async function getQualityOfHire() {
  const rated = await prisma.candidate.findMany({
    where: { stage: "CONTRATADO", qualityScore: { not: null } },
    select: { qualityScore: true },
  });
  if (rated.length === 0) return null;
  const avg = rated.reduce((acc, c) => acc + (c.qualityScore ?? 0), 0) / rated.length;
  return Math.round(avg);
}
