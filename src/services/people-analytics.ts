import { prisma } from "@/lib/prisma";
import { MovementType } from "@prisma/client";
import { resolvePeriod, lastNMonthsKeys } from "@/services/period";
import { pearsonCorrelation } from "@/lib/analytics/correlation";
import { getTurnoverKpis } from "@/services/turnover";
import { getAbsenteismoKpis } from "@/services/absenteismo";
import { getClimaKpis } from "@/services/clima";
import type { ExecutiveFilters } from "@/services/dashboard-executivo";

export async function getCorrelations(filters: ExecutiveFilters) {
  const months = lastNMonthsKeys(12);

  const overtimeSeries = await Promise.all(
    months.map(async (key) => {
      const [y, m] = key.split("-").map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0, 23, 59, 59);
      const agg = await prisma.timeEntry.aggregate({
        _sum: { overtimeHours: true },
        where: { date: { gte: start, lte: end }, ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}) },
      });
      return agg._sum.overtimeHours ?? 0;
    })
  );

  const absenceSeries = await Promise.all(
    months.map(async (key) => {
      const [y, m] = key.split("-").map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0, 23, 59, 59);
      const agg = await prisma.absence.aggregate({
        _sum: { hoursLost: true },
        where: { date: { gte: start, lte: end }, ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}) },
      });
      return agg._sum.hoursLost ?? 0;
    })
  );

  const turnover = await getTurnoverKpis(filters);

  const correlationOvertimeAbsence = pearsonCorrelation(overtimeSeries, absenceSeries);
  const correlationTurnoverAbsence = pearsonCorrelation(turnover.series, absenceSeries);

  return [
    { name: "Horas Extras x Absenteísmo", value: Number(correlationOvertimeAbsence.toFixed(2)) },
    { name: "Turnover x Absenteísmo", value: Number(correlationTurnoverAbsence.toFixed(2)) },
  ];
}

export async function getRiskRankingByManager(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  const managers = await prisma.manager.findMany({
    select: {
      name: true,
      employees: {
        where: filters.unitId ? { unitId: filters.unitId } : {},
        select: {
          movements: { where: { type: MovementType.DESLIGAMENTO, date: { gte: range.start, lte: range.end } }, select: { id: true } },
          absences: { where: { date: { gte: range.start, lte: range.end } }, select: { hoursLost: true } },
        },
      },
    },
  });

  return managers
    .map((m) => {
      const terminations = m.employees.reduce((acc, e) => acc + e.movements.length, 0);
      const absenceHours = m.employees.reduce((acc, e) => acc + e.absences.reduce((a, x) => a + x.hoursLost, 0), 0);
      const riskScore = terminations * 10 + absenceHours * 0.1;
      return { name: m.name, value: Math.round(riskScore) };
    })
    .filter((m) => m.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
}

export interface FlightRiskEmployee {
  employeeId: string;
  name: string;
  position: string;
  manager: string;
  unit: string;
  riskScore: number;
  riskLevel: "Alto" | "Médio" | "Baixo";
  factors: string[];
}

const PERFORMANCE_CYCLE = "2026-S1";

/**
 * Modelo de risco de saída (Flight Risk) — baseado em regras explicáveis,
 * não em um modelo de machine learning "caixa-preta". Cada fator soma pontos
 * (0-100) e é listado individualmente para o gestor entender exatamente o
 * porquê do score, condição essencial para uso responsável em decisões de RH.
 */
export async function getFlightRiskEmployees(filters: ExecutiveFilters): Promise<FlightRiskEmployee[]> {
  const now = new Date();
  const window90 = new Date(now.getTime() - 90 * 86400000);
  const stagnationCutoff = new Date(now.getFullYear() - 3, now.getMonth(), now.getDate());
  const recentPromotionCutoff = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());

  const employees = await prisma.employee.findMany({
    where: { isActive: true, ...(filters.unitId ? { unitId: filters.unitId } : {}) },
    select: {
      id: true,
      name: true,
      admissionDate: true,
      position: { select: { name: true } },
      manager: { select: { name: true } },
      unit: { select: { name: true } },
    },
  });
  const employeeIds = employees.map((e) => e.id);
  if (employeeIds.length === 0) return [];

  const [reviews, absenceAgg, overtimeAgg, lastMovements] = await Promise.all([
    prisma.performanceReview.findMany({
      where: { cycle: PERFORMANCE_CYCLE, employeeId: { in: employeeIds } },
      select: { employeeId: true, score: true },
    }),
    prisma.absence.groupBy({
      by: ["employeeId"],
      _sum: { hoursLost: true },
      where: { employeeId: { in: employeeIds }, date: { gte: window90 } },
    }),
    prisma.timeEntry.groupBy({
      by: ["employeeId"],
      _sum: { overtimeHours: true },
      where: { employeeId: { in: employeeIds }, date: { gte: window90 } },
    }),
    prisma.movement.findMany({
      where: { employeeId: { in: employeeIds }, type: { in: [MovementType.PROMOCAO, MovementType.TRANSFERENCIA] } },
      orderBy: { date: "desc" },
      distinct: ["employeeId"],
      select: { employeeId: true, date: true },
    }),
  ]);

  const scoreByEmployee = new Map(reviews.map((r) => [r.employeeId, r.score]));
  const absenceByEmployee = new Map(absenceAgg.map((a) => [a.employeeId, a._sum.hoursLost ?? 0]));
  const overtimeByEmployee = new Map(overtimeAgg.map((o) => [o.employeeId, o._sum.overtimeHours ?? 0]));
  const lastMoveByEmployee = new Map(lastMovements.map((m) => [m.employeeId, m.date]));

  const results: FlightRiskEmployee[] = employees.map((e) => {
    let score = 0;
    const factors: string[] = [];

    const perfScore = scoreByEmployee.get(e.id);
    if (perfScore !== undefined && perfScore < 3.0) {
      score += 30;
      factors.push("Desempenho abaixo do esperado no último ciclo");
    }

    const absenceHours = absenceByEmployee.get(e.id) ?? 0;
    if (absenceHours > 24) {
      score += 20;
      factors.push("Aumento de afastamentos nos últimos 90 dias");
    }

    const overtimeHours = overtimeByEmployee.get(e.id) ?? 0;
    if (overtimeHours > 40) {
      score += 20;
      factors.push("Volume elevado de horas extras (risco de burnout)");
    }

    const lastMove = lastMoveByEmployee.get(e.id);
    const referenceDate = lastMove ?? e.admissionDate;
    if (referenceDate < stagnationCutoff) {
      score += 15;
      factors.push("Mais de 3 anos sem promoção ou movimentação interna");
    }

    if (perfScore !== undefined && perfScore >= 4.5 && (!lastMove || lastMove < recentPromotionCutoff)) {
      score += 15;
      factors.push("Alto performer sem reconhecimento recente — risco de perda de talento-chave");
    }

    const riskLevel: FlightRiskEmployee["riskLevel"] = score >= 60 ? "Alto" : score >= 30 ? "Médio" : "Baixo";

    return {
      employeeId: e.id,
      name: e.name,
      position: e.position?.name ?? "—",
      manager: e.manager?.name ?? "—",
      unit: e.unit.name,
      riskScore: score,
      riskLevel,
      factors,
    };
  });

  return results.filter((r) => r.riskScore > 0).sort((a, b) => b.riskScore - a.riskScore);
}

export async function getFlightRiskSummary(filters: ExecutiveFilters) {
  const employees = await getFlightRiskEmployees(filters);
  return {
    highRiskCount: employees.filter((e) => e.riskLevel === "Alto").length,
    mediumRiskCount: employees.filter((e) => e.riskLevel === "Médio").length,
    totalFlagged: employees.length,
    topRisks: employees.slice(0, 20),
  };
}

export async function getInsightsNarrative(filters: ExecutiveFilters) {
  const [turnover, absenteeism, clima, correlations] = await Promise.all([
    getTurnoverKpis(filters),
    getAbsenteismoKpis(filters),
    getClimaKpis(filters),
    getCorrelations(filters),
  ]);

  const insights: string[] = [];

  const overtimeAbsenceCorr = correlations.find((c) => c.name.includes("Horas Extras"))?.value ?? 0;
  if (overtimeAbsenceCorr > 0.5) {
    insights.push(
      `Existe uma correlação forte (${overtimeAbsenceCorr.toFixed(2)}) entre horas extras e absenteísmo — o excesso de HE pode estar contribuindo para o aumento das faltas.`
    );
  }

  if (turnover.current.rate > turnover.previous.rate) {
    insights.push("O turnover está em trajetória de alta — recomenda-se revisar as áreas com maior concentração de saídas voluntárias.");
  } else {
    insights.push("O turnover está estável ou em queda em relação ao período anterior.");
  }

  if (clima.enps < 30) {
    insights.push(`O eNPS (${clima.enps.toFixed(0)}) está abaixo do patamar saudável — vale priorizar ações de engajamento.`);
  } else {
    insights.push(`O eNPS (${clima.enps.toFixed(0)}) está em patamar saudável.`);
  }

  if (absenteeism.rate > 0.04) {
    insights.push("O absenteísmo está acima de 4%, patamar que costuma indicar problemas pontuais de gestão ou saúde ocupacional.");
  }

  return insights;
}
