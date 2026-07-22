import { prisma } from "@/lib/prisma";
import { Severity, VacancyStatus } from "@prisma/client";
import { getTurnoverKpi, getAbsenteeismKpi, getEnpsKpi } from "@/services/dashboard-executivo";
import { getRecrutamentoKpis } from "@/services/recrutamento";
import { getInternalMobilityKpis } from "@/services/lideranca";
import { getOverallPayGap } from "@/services/diversidade";
import { getFlightRiskSummary } from "@/services/people-analytics";

interface Signal {
  moduleKey: string;
  title: string;
  description: string;
  severity: Severity;
}

async function evaluateGoalSignals(): Promise<Signal[]> {
  const year = new Date().getFullYear();
  const goals = await prisma.goal.findMany({ where: { periodYear: year } });
  if (goals.length === 0) return [];

  const goalByKey = new Map(goals.map((g) => [`${g.moduleKey}:${g.indicator}`, g]));
  const signals: Signal[] = [];

  function checkGoal(
    key: string,
    currentValue: number | null,
    moduleKey: string,
    formatValue: (v: number) => string,
    label: string
  ) {
    const goal = goalByKey.get(key);
    if (!goal || currentValue === null || Number.isNaN(currentValue)) return;

    const violated =
      goal.comparator === "LTE"
        ? currentValue > goal.targetValue
        : goal.comparator === "GTE"
        ? currentValue < goal.targetValue
        : currentValue !== goal.targetValue;

    if (!violated) return;

    const deviation = goal.targetValue !== 0 ? Math.abs(currentValue - goal.targetValue) / Math.abs(goal.targetValue) : 1;
    const severity = deviation > 0.2 ? Severity.CRITICO : Severity.ATENCAO;

    signals.push({
      moduleKey,
      title: `${label} fora da meta`,
      description: `${label} está em ${formatValue(currentValue)}, enquanto a meta cadastrada para ${year} é ${formatValue(goal.targetValue)}.`,
      severity,
    });
  }

  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;
  const num = (v: number) => v.toFixed(1);

  const [turnover, absenteeism, enps, recrutamento, mobility, payGap] = await Promise.all([
    getTurnoverKpi({}),
    getAbsenteeismKpi({}),
    getEnpsKpi(),
    getRecrutamentoKpis({}),
    getInternalMobilityKpis({}),
    getOverallPayGap({}),
  ]);

  checkGoal("turnover:turnover_geral", turnover.current, "turnover", pct, "Turnover geral");
  checkGoal("absenteismo:taxa_absenteismo", absenteeism.current, "absenteismo", pct, "Taxa de absenteísmo");
  checkGoal("clima:enps", enps.current, "clima", num, "eNPS");
  if (recrutamento.hiredCount > 0) {
    checkGoal("recrutamento:time_to_hire", recrutamento.avgTimeToHire, "recrutamento", (v) => `${v.toFixed(0)} dias`, "Time to hire");
  }
  checkGoal("lideranca:taxa_mobilidade_interna", mobility.mobilityRate, "lideranca", pct, "Taxa de mobilidade interna");
  if (payGap.overallGapPercent !== null && !Number.isNaN(payGap.overallGapPercent)) {
    checkGoal("diversidade:gap_salarial_genero", payGap.overallGapPercent, "diversidade", (v) => `${v.toFixed(1)}%`, "Gap salarial de gênero");
  }

  return signals;
}

async function evaluateVacancySignals(): Promise<Signal[]> {
  const openVacancies = await prisma.vacancy.findMany({
    where: { status: { in: [VacancyStatus.ABERTA, VacancyStatus.EM_ANDAMENTO] } },
    select: { title: true, openedAt: true, targetDays: true, isCritical: true },
  });

  const now = new Date();
  const overdue = openVacancies.filter((v) => {
    const daysOpen = (now.getTime() - v.openedAt.getTime()) / 86_400_000;
    return daysOpen > v.targetDays;
  });

  if (overdue.length === 0) return [];

  const criticalOverdue = overdue.filter((v) => v.isCritical).length;

  return [
    {
      moduleKey: "recrutamento",
      title: "Vagas abertas além do prazo previsto",
      description: `${overdue.length} vaga(s) já ultrapassaram o prazo (targetDays) cadastrado para preenchimento${
        criticalOverdue > 0 ? `, sendo ${criticalOverdue} crítica(s)` : ""
      }.`,
      severity: criticalOverdue > 0 ? Severity.CRITICO : Severity.ATENCAO,
    },
  ];
}

async function evaluateTrainingSignals(): Promise<Signal[]> {
  const now = new Date();
  const in30Days = new Date(now.getTime() + 30 * 86_400_000);

  const expiring = await prisma.trainingRecord.findMany({
    where: { isMandatory: true, expiresAt: { gte: now, lte: in30Days } },
    select: { title: true },
  });

  if (expiring.length === 0) return [];

  return [
    {
      moduleKey: "treinamento",
      title: "Treinamentos obrigatórios a vencer",
      description: `${expiring.length} treinamento(s) obrigatório(s) com vencimento nos próximos 30 dias.`,
      severity: Severity.ATENCAO,
    },
  ];
}

async function evaluateFlightRiskSignals(): Promise<Signal[]> {
  const { highRiskCount, totalFlagged } = await getFlightRiskSummary({});
  if (highRiskCount === 0) return [];

  return [
    {
      moduleKey: "people-analytics",
      title: "Colaboradores em risco alto de saída",
      description: `O modelo de Flight Risk sinalizou ${highRiskCount} colaborador(es) em risco alto de saída, de um total de ${totalFlagged} sinalizado(s).`,
      severity: highRiskCount >= 5 ? Severity.CRITICO : Severity.ATENCAO,
    },
  ];
}

/** Colaboradores com 3 ou mais atestados médicos nos últimos 30 dias — padrão que vale investigar. */
async function evaluateAtestadosSignals(): Promise<Signal[]> {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const absences = await prisma.absence.findMany({
    where: { date: { gte: since }, hasCertificate: true },
    select: { employeeId: true, employee: { select: { name: true } } },
  });

  const byEmployee = new Map<string, { name: string; count: number }>();
  for (const a of absences) {
    const cur = byEmployee.get(a.employeeId) ?? { name: a.employee.name, count: 0 };
    cur.count += 1;
    byEmployee.set(a.employeeId, cur);
  }
  const frequent = Array.from(byEmployee.values()).filter((e) => e.count >= 3);
  if (frequent.length === 0) return [];

  return [
    {
      moduleKey: "sst",
      title: "Colaboradores com atestados frequentes",
      description: `${frequent.length} colaborador(es) tiveram 3 ou mais atestados nos últimos 30 dias (ex.: ${frequent
        .slice(0, 3)
        .map((e) => e.name)
        .join(", ")}${frequent.length > 3 ? "..." : ""}). Vale uma conversa de acompanhamento.`,
      severity: frequent.length >= 3 ? Severity.CRITICO : Severity.ATENCAO,
    },
  ];
}

/** Advertências disciplinares registradas nos últimos 30 dias. */
async function evaluateComplianceSignals(): Promise<Signal[]> {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const events = await prisma.complianceEvent.findMany({
    where: { date: { gte: since }, type: "ADVERTENCIA" },
    select: { id: true },
  });
  if (events.length === 0) return [];

  return [
    {
      moduleKey: "compliance",
      title: "Advertências registradas no último mês",
      description: `${events.length} advertência(s) registrada(s) nos últimos 30 dias.`,
      severity: events.length >= 5 ? Severity.CRITICO : Severity.ATENCAO,
    },
  ];
}

export async function syncAlerts(): Promise<void> {
  const [goalSignals, vacancySignals, trainingSignals, flightRiskSignals, atestadosSignals, complianceSignals] = await Promise.all([
    evaluateGoalSignals(),
    evaluateVacancySignals(),
    evaluateTrainingSignals(),
    evaluateFlightRiskSignals(),
    evaluateAtestadosSignals(),
    evaluateComplianceSignals(),
  ]);

  const signals = [...goalSignals, ...vacancySignals, ...trainingSignals, ...flightRiskSignals, ...atestadosSignals, ...complianceSignals];
  const signalKeys = new Set(signals.map((s) => `${s.moduleKey}::${s.title}`));

  const activeAlerts = await prisma.alert.findMany({ where: { isActive: true } });

  const toResolve = activeAlerts.filter((a) => !signalKeys.has(`${a.moduleKey}::${a.title}`));
  if (toResolve.length > 0) {
    await prisma.alert.updateMany({
      where: { id: { in: toResolve.map((a) => a.id) } },
      data: { isActive: false, resolvedAt: new Date() },
    });
  }

  const activeKeys = new Set(activeAlerts.map((a) => `${a.moduleKey}::${a.title}`));
  const toCreate = signals.filter((s) => !activeKeys.has(`${s.moduleKey}::${s.title}`));
  if (toCreate.length > 0) {
    await prisma.alert.createMany({
      data: toCreate.map((s) => ({
        moduleKey: s.moduleKey,
        title: s.title,
        description: s.description,
        severity: s.severity,
      })),
    });
  } else {
    for (const s of signals) {
      const existing = activeAlerts.find((a) => a.moduleKey === s.moduleKey && a.title === s.title);
      if (existing && (existing.description !== s.description || existing.severity !== s.severity)) {
        await prisma.alert.update({
          where: { id: existing.id },
          data: { description: s.description, severity: s.severity },
        });
      }
    }
  }
}
