import { prisma } from "@/lib/prisma";
import { MovementType, FunnelStage } from "@prisma/client";
import { resolvePeriod, previousPeriod, percentDelta, lastNMonthsKeys, type DateRange } from "@/services/period";
import { activePresentEmployeeWhere } from "@/lib/employee-filters";

export interface ExecutiveFilters {
  unitId?: string;
  period?: string;
  /** Setor principal (CostCenter) do colaborador. */
  costCenterId?: string;
  /** Setor secundário (CostCenter) do colaborador. */
  secondaryCostCenterId?: string;
}

async function activeHeadcountAt(date: Date, unitId?: string) {
  return prisma.employee.count({
    where: {
      ...activePresentEmployeeWhere(date),
      admissionDate: { lte: date },
      OR: [{ terminationDate: null }, { terminationDate: { gt: date } }],
      ...(unitId ? { unitId } : {}),
    },
  });
}

async function averageHeadcount(range: DateRange, unitId?: string) {
  const startCount = await activeHeadcountAt(range.start, unitId);
  const endCount = await activeHeadcountAt(range.end, unitId);
  return (startCount + endCount) / 2 || 1;
}

export async function getHeadcountKpi(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  const prev = previousPeriod(range);

  const [current, previous] = await Promise.all([
    activeHeadcountAt(range.end, filters.unitId),
    activeHeadcountAt(prev.end, filters.unitId),
  ]);

  const months = lastNMonthsKeys(12);
  const series = await Promise.all(
    months.map(async (key) => {
      const [y, m] = key.split("-").map(Number);
      const refDate = new Date(y, m, 0, 23, 59, 59);
      return activeHeadcountAt(refDate, filters.unitId);
    })
  );

  return { current, previous, delta: percentDelta(current, previous), series };
}

export async function getTurnoverKpi(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  const prev = previousPeriod(range);

  async function turnoverRate(r: DateRange) {
    const terminations = await prisma.movement.count({
      where: {
        type: MovementType.DESLIGAMENTO,
        date: { gte: r.start, lte: r.end },
        ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}),
      },
    });
    const avgHc = await averageHeadcount(r, filters.unitId);
    return terminations / avgHc;
  }

  const [current, previous] = await Promise.all([turnoverRate(range), turnoverRate(prev)]);

  const months = lastNMonthsKeys(12);
  const series = await Promise.all(
    months.map(async (key) => {
      const [y, m] = key.split("-").map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0, 23, 59, 59);
      return turnoverRate({ start, end, months: 1 });
    })
  );

  return { current, previous, delta: percentDelta(current, previous), series };
}

export async function getAbsenteeismKpi(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  const prev = previousPeriod(range);

  async function rate(r: DateRange) {
    const [lostAgg, scheduledAgg] = await Promise.all([
      prisma.absence.aggregate({
        _sum: { hoursLost: true },
        where: {
          date: { gte: r.start, lte: r.end },
          ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}),
        },
      }),
      prisma.timeEntry.aggregate({
        _sum: { scheduledHours: true },
        where: {
          date: { gte: r.start, lte: r.end },
          ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}),
        },
      }),
    ]);
    const lost = lostAgg._sum.hoursLost ?? 0;
    const scheduled = scheduledAgg._sum.scheduledHours ?? 1;
    return lost / scheduled;
  }

  const [current, previous] = await Promise.all([rate(range), rate(prev)]);
  return { current, previous, delta: percentDelta(current, previous) };
}

const ENPS_DIMENSION = "Recomendaria a Empresa (eNPS)";

export async function getEnpsKpi() {
  const latest = await prisma.climateSurveyResponse.findFirst({
    orderBy: { createdAt: "desc" },
    select: { cycle: true },
  });
  if (!latest) return { current: 0, cycle: null as string | null };

  // Importante: a pesquisa de clima tem várias dimensões (Liderança,
  // Reconhecimento, Comunicação, etc.). O eNPS deve considerar apenas as
  // respostas da pergunta específica "Recomendaria a Empresa (eNPS)" — do
  // contrário, notas de outras dimensões são contadas como se fossem
  // promotoras/detratoras do eNPS, distorcendo o resultado para baixo.
  // Este filtro replica a mesma lógica usada em src/services/clima.ts,
  // que é a fonte dos relatórios PCO 2026.
  const responses = await prisma.climateSurveyResponse.findMany({
    where: { cycle: latest.cycle, dimension: ENPS_DIMENSION },
    select: { score: true },
  });

  const total = responses.length || 1;
  const promoters = responses.filter((r) => r.score >= 9).length;
  const detractors = responses.filter((r) => r.score <= 6).length;
  const enps = responses.length > 0 ? ((promoters - detractors) / total) * 100 : 0;

  return { current: Math.round(enps * 10) / 10, cycle: latest.cycle };
}

export async function getCriticalVacancies() {
  return prisma.candidate.count({
    where: { isCritical: true, stage: { notIn: [FunnelStage.CONTRATADO, FunnelStage.REPROVADO] } },
  });
}

export async function getPeopleCostKpi(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);

  const payrollAgg = await prisma.payrollEntry.aggregate({
    _sum: { totalCost: true },
    where: {
      competence: { gte: range.start, lte: range.end },
      ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}),
    },
  });

  const revenueAgg = await prisma.revenueEntry.aggregate({
    _sum: { amount: true },
    where: { competence: { gte: range.start, lte: range.end } },
  });

  const totalCost = payrollAgg._sum.totalCost ?? 0;
  const totalRevenue = revenueAgg._sum.amount ?? 0;
  const ratio = totalRevenue > 0 ? totalCost / totalRevenue : null;

  return { totalCost, totalRevenue, ratio };
}

export async function getHumanCapitalEfficiency(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);

  const [payrollAgg, revenueAgg, headcountStart, headcountEnd] = await Promise.all([
    prisma.payrollEntry.aggregate({
      _sum: { totalCost: true },
      where: { competence: { gte: range.start, lte: range.end }, ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}) },
    }),
    prisma.revenueEntry.aggregate({
      _sum: { amount: true },
      where: { competence: { gte: range.start, lte: range.end } },
    }),
    activeHeadcountAt(range.start, filters.unitId),
    activeHeadcountAt(range.end, filters.unitId),
  ]);

  const totalCost = payrollAgg._sum.totalCost ?? 0;
  const totalRevenue = revenueAgg._sum.amount ?? 0;
  const avgHeadcount = (headcountStart + headcountEnd) / 2 || 1;

  const revenuePerEmployee = totalRevenue / avgHeadcount;
  // HCROI aproximado (Saratoga simplificado): sem uma linha de despesas operacionais
  // totais no modelo de dados, usamos (Receita - Custo de Pessoal) / Custo de Pessoal
  // como proxy de retorno sobre o investimento em capital humano.
  const hcroiApprox = totalCost > 0 ? (totalRevenue - totalCost) / totalCost : null;

  return { revenuePerEmployee, hcroiApprox, totalRevenue, totalCost, avgHeadcount };
}

export async function getActiveAlerts() {
  return prisma.alert.findMany({
    where: { isActive: true },
    orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
    take: 6,
  });
}

export async function getHeadcountByUnit() {
  const units = await prisma.unit.findMany({
    select: {
      id: true,
      name: true,
      _count: { select: { employees: { where: { isActive: true } } } },
    },
  });
  return units.map((u) => ({ name: u.name, headcount: u._count.employees }));
}

export async function getExecutiveNarrative(filters: ExecutiveFilters) {
  const [headcount, turnover, absenteeism, enps, vacancies] = await Promise.all([
    getHeadcountKpi(filters),
    getTurnoverKpi(filters),
    getAbsenteeismKpi(filters),
    getEnpsKpi(),
    getCriticalVacancies(),
  ]);

  const parts: string[] = [];

  parts.push(
    turnover.delta > 0.05
      ? `O turnover subiu ${(turnover.delta * 100).toFixed(1)}% no período em relação ao período anterior.`
      : turnover.delta < -0.05
      ? `O turnover recuou ${Math.abs(turnover.delta * 100).toFixed(1)}% no período, sinal positivo de retenção.`
      : `O turnover está estável em relação ao período anterior.`
  );

  parts.push(
    absenteeism.delta > 0.05
      ? `O absenteísmo apresentou alta em relação ao período anterior — vale investigar por setor.`
      : `O absenteísmo segue dentro do padrão histórico.`
  );

  if (vacancies > 0) {
    parts.push(`Há ${vacancies} vaga(s) crítica(s) em aberto que merecem atenção da liderança.`);
  }

  if (enps.current !== 0) {
    parts.push(`O eNPS do último ciclo (${enps.cycle}) está em ${enps.current.toFixed(0)} pontos.`);
  }

  return { headline: parts.join(" "), headcount, turnover, absenteeism, enps, vacancies };
}
