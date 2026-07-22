import { prisma } from "@/lib/prisma";
import { MovementType } from "@prisma/client";
import { resolvePeriod, previousPeriod, percentDelta, lastNMonthsKeys } from "@/services/period";
import { linearForecast, trendDirection } from "@/services/forecast";
import type { ExecutiveFilters } from "@/services/dashboard-executivo";
import { activePresentEmployeeWhere } from "@/lib/employee-filters";

async function activeCountAt(date: Date, unitId?: string) {
  return prisma.employee.count({
    where: {
      ...activePresentEmployeeWhere(date),
      admissionDate: { lte: date },
      OR: [{ terminationDate: null }, { terminationDate: { gt: date } }],
      ...(unitId ? { unitId } : {}),
    },
  });
}

export async function getHeadcountKpis(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  const prev = previousPeriod(range);

  const [current, previous, admissions, terminations] = await Promise.all([
    activeCountAt(range.end, filters.unitId),
    activeCountAt(prev.end, filters.unitId),
    prisma.movement.count({
      where: {
        type: MovementType.ADMISSAO,
        date: { gte: range.start, lte: range.end },
        ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}),
      },
    }),
    prisma.movement.count({
      where: {
        type: MovementType.DESLIGAMENTO,
        date: { gte: range.start, lte: range.end },
        ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}),
      },
    }),
  ]);

  const months = lastNMonthsKeys(12);
  const series = await Promise.all(
    months.map(async (key) => {
      const [y, m] = key.split("-").map(Number);
      const refDate = new Date(y, m, 0, 23, 59, 59);
      return activeCountAt(refDate, filters.unitId);
    })
  );

  return {
    current,
    previous,
    delta: percentDelta(current, previous),
    admissions,
    terminations,
    netChange: admissions - terminations,
    series,
  };
}

export async function getHeadcountByCostCenter(unitId?: string) {
  const costCenters = await prisma.costCenter.findMany({
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          employees: {
            where: { isActive: true, ...(unitId ? { unitId } : {}) },
          },
        },
      },
    },
  });
  return costCenters
    .map((c) => ({ name: c.name, headcount: c._count.employees }))
    .filter((c) => c.headcount > 0)
    .sort((a, b) => b.headcount - a.headcount);
}

export async function getHeadcountBySecondaryCostCenter(unitId?: string) {
  const costCenters = await prisma.costCenter.findMany({
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          secondaryEmployees: {
            where: { isActive: true, ...(unitId ? { unitId } : {}) },
          },
        },
      },
    },
  });
  return costCenters
    .map((c) => ({ name: c.name, headcount: c._count.secondaryEmployees }))
    .filter((c) => c.headcount > 0)
    .sort((a, b) => b.headcount - a.headcount);
}

export interface IdealVsRealSector {
  id: string;
  name: string;
  ideal: number | null;
  real: number;
  diff: number | null;
}

export interface IdealVsRealArea {
  area: string;
  ideal: number;
  real: number;
  diff: number;
  sectors: IdealVsRealSector[];
}

/**
 * Quadro Ideal x Real agrupado por ÁREA (Produção, Comercial, Logística,
 * Administrativo...), somando todos os setores dentro de cada área. O "real"
 * usa o setor SECUNDÁRIO do colaborador, que é o campo que de fato está
 * preenchido no cadastro hoje (o setor principal ainda está vazio para a
 * maior parte dos colaboradores).
 */
export async function getIdealVsRealHeadcount(): Promise<IdealVsRealArea[]> {
  const presentFilter = activePresentEmployeeWhere();
  const costCenters = await prisma.costCenter.findMany({
    where: {
      OR: [{ targetHeadcount: { not: null } }, { secondaryEmployees: { some: { isActive: true } } }],
    },
    select: {
      id: true,
      name: true,
      area: true,
      targetHeadcount: true,
      _count: { select: { secondaryEmployees: { where: presentFilter } } },
    },
  });

  const byArea = new Map<string, IdealVsRealArea>();
  for (const c of costCenters) {
    const entry = byArea.get(c.area) ?? { area: c.area, ideal: 0, real: 0, diff: 0, sectors: [] as IdealVsRealSector[] };
    const ideal = c.targetHeadcount ?? 0;
    const real = c._count.secondaryEmployees;
    entry.ideal += ideal;
    entry.real += real;
    entry.sectors.push({
      id: c.id,
      name: c.name,
      ideal: c.targetHeadcount,
      real,
      diff: c.targetHeadcount !== null ? real - c.targetHeadcount : null,
    });
    byArea.set(c.area, entry);
  }

  return Array.from(byArea.values())
    .map((a) => ({ ...a, diff: a.real - a.ideal, sectors: a.sectors.sort((s1, s2) => s2.real - s1.real) }))
    .sort((a, b) => b.ideal - a.ideal);
}

export async function getHeadcountByManager(unitId?: string) {
  const managers = await prisma.manager.findMany({
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          employees: {
            where: { isActive: true, ...(unitId ? { unitId } : {}) },
          },
        },
      },
    },
  });
  return managers
    .map((m) => ({ name: m.name, headcount: m._count.employees }))
    .filter((m) => m.headcount > 0)
    .sort((a, b) => b.headcount - a.headcount);
}

export async function getHeadcountForecast(filters: ExecutiveFilters) {
  const months = lastNMonthsKeys(6);
  const series = await Promise.all(
    months.map(async (key) => {
      const [y, m] = key.split("-").map(Number);
      const refDate = new Date(y, m, 0, 23, 59, 59);
      return activeCountAt(refDate, filters.unitId);
    })
  );

  const forecast = linearForecast(series, 3).map((v) => Math.round(v));
  const direction = trendDirection(series);
  const projected3Months = forecast[forecast.length - 1] ?? series[series.length - 1] ?? 0;

  return {
    historicalSeries: series,
    forecastSeries: forecast,
    direction,
    projected3Months,
  };
}

export async function getHeadcountPyramid(unitId?: string) {
  const employees = await prisma.employee.findMany({
    where: { isActive: true, ...(unitId ? { unitId } : {}) },
    select: { birthDate: true, gender: true },
  });

  const buckets = ["18-24", "25-34", "35-44", "45-54", "55+"];
  const result = buckets.map((label) => ({ label, masculino: 0, feminino: 0 }));

  const now = new Date();
  for (const emp of employees) {
    if (!emp.birthDate) continue;
    const age = now.getFullYear() - emp.birthDate.getFullYear();
    const idx = age < 25 ? 0 : age < 35 ? 1 : age < 45 ? 2 : age < 55 ? 3 : 4;
    if (emp.gender === "MASCULINO") result[idx].masculino += 1;
    else if (emp.gender === "FEMININO") result[idx].feminino += 1;
  }
  return result;
}

export async function getHeadcountTable(filters: ExecutiveFilters) {
  const employees = await prisma.employee.findMany({
    where: { isActive: true, ...(filters.unitId ? { unitId: filters.unitId } : {}) },
    include: { position: true, costCenter: true, manager: true, unit: true },
    orderBy: { admissionDate: "desc" },
    take: 50,
  });
  return employees;
}

export async function getAverageTenureMonths(unitId?: string) {
  const employees = await prisma.employee.findMany({
    where: { isActive: true, ...(unitId ? { unitId } : {}) },
    select: { admissionDate: true },
  });
  if (employees.length === 0) return 0;
  const now = new Date();
  const totalMonths = employees.reduce((acc, e) => {
    const months = (now.getFullYear() - e.admissionDate.getFullYear()) * 12 + (now.getMonth() - e.admissionDate.getMonth());
    return acc + months;
  }, 0);
  return totalMonths / employees.length;
}
