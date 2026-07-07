import { prisma } from "@/lib/prisma";

export async function getAdminUsers() {
  return prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true, unit: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function getAdminGoals() {
  return prisma.goal.findMany({ orderBy: [{ moduleKey: "asc" }, { periodYear: "desc" }] });
}

export async function getAdminAccessLogs() {
  return prisma.accessLog.findMany({
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function getDataFreshness() {
  const [lastPayroll, lastTimeEntry, lastClimate, lastCandidate] = await Promise.all([
    prisma.payrollEntry.findFirst({ orderBy: { competence: "desc" }, select: { competence: true } }),
    prisma.timeEntry.findFirst({ orderBy: { date: "desc" }, select: { date: true } }),
    prisma.climateSurveyResponse.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.candidate.findFirst({ orderBy: { openedAt: "desc" }, select: { openedAt: true } }),
  ]);

  return [
    { source: "Folha de Pagamento", lastUpdate: lastPayroll?.competence ?? null },
    { source: "Ponto / Jornada", lastUpdate: lastTimeEntry?.date ?? null },
    { source: "Pesquisa de Clima", lastUpdate: lastClimate?.createdAt ?? null },
    { source: "Recrutamento (ATS)", lastUpdate: lastCandidate?.openedAt ?? null },
  ];
}
