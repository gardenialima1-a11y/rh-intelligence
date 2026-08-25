import { prisma } from "@/lib/prisma";

// Etapas realmente usadas pelo formulário de candidato (ver
// FUNNEL_STAGE_OPTIONS em lib/validation/candidate.ts). CADASTRO, ANALISE_CPF
// e ADMISSAO existem no enum do banco mas não são selecionáveis na tela hoje,
// então não entram nesta linha do tempo (senão aparecem sempre com "0d").
export const STAGE_ORDER = [
  "TRIAGEM",
  "ENTREVISTA_RH",
  "ENTREVISTA_GESTOR",
  "TESTE",
  "PROPOSTA",
  "CONTRATADO",
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

export interface VacancyPipelineCandidate {
  id: string;
  name: string;
  stage: (typeof STAGE_ORDER)[number];
  source: string;
  isCritical: boolean;
  daysInStage: number;
  enteredStageAt: Date;
}

export interface VacancyPipeline {
  id: string;
  title: string;
  unit: string | null;
  status: string;
  isCritical: boolean;
  daysOpen: number;
  targetDays: number;
  urgency: "CRITICA" | "ATENCAO" | "OK";
  candidates: VacancyPipelineCandidate[];
  rejectedCount: number;
}

/**
 * Status ao vivo de cada vaga aberta/em andamento/em pausa: em qual etapa do
 * funil (Triagem → Entrevista RH → Entrevista Gestor → Teste → Proposta →
 * Contratado) cada candidato está agora, e há quantos dias está parado ali —
 * calculado a partir do registro de CandidateStageHistory ainda aberto
 * (exitedAt nulo). É a fonte de dados da "linha do tempo" visual por vaga.
 */
export async function getVacancyPipelines(): Promise<VacancyPipeline[]> {
  const vacancies = await prisma.vacancy.findMany({
    where: { status: { in: ["ABERTA", "EM_ANDAMENTO", "EM_PAUSA"] } },
    include: {
      unit: true,
      candidates: {
        include: {
          stageHistory: {
            where: { exitedAt: null },
            orderBy: { enteredAt: "desc" },
            take: 1,
          },
        },
      },
    },
    orderBy: { openedAt: "asc" },
  });

  const now = Date.now();

  return vacancies.map((v) => {
    const daysOpen = Math.floor((now - v.openedAt.getTime()) / 86400000);
    const urgency: "CRITICA" | "ATENCAO" | "OK" =
      daysOpen > v.targetDays ? "CRITICA" : daysOpen > v.targetDays * 0.7 ? "ATENCAO" : "OK";

    const activeCandidates = v.candidates.filter((c) => c.stage !== "REPROVADO" && c.stage !== "CONTRATADO");
    const rejectedCount = v.candidates.filter((c) => c.stage === "REPROVADO").length;

    const candidates: VacancyPipelineCandidate[] = activeCandidates
      .filter((c): c is typeof c & { stage: (typeof STAGE_ORDER)[number] } =>
        (STAGE_ORDER as readonly string[]).includes(c.stage)
      )
      .map((c) => {
        const openEntry = c.stageHistory[0];
        const enteredStageAt = openEntry?.enteredAt ?? c.openedAt;
        const daysInStage = Math.max(0, Math.floor((now - enteredStageAt.getTime()) / 86400000));
        return {
          id: c.id,
          name: c.name,
          stage: c.stage,
          source: c.source,
          isCritical: c.isCritical,
          daysInStage,
          enteredStageAt,
        };
      })
      .sort((a, b) => b.daysInStage - a.daysInStage);

    return {
      id: v.id,
      title: v.title,
      unit: v.unit?.name ?? null,
      status: v.status,
      isCritical: v.isCritical,
      daysOpen,
      targetDays: v.targetDays,
      urgency,
      candidates,
      rejectedCount,
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
