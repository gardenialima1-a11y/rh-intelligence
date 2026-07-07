import { prisma } from "@/lib/prisma";
import { MovementType } from "@prisma/client";
import { resolvePeriod, previousPeriod, percentDelta, lastNMonthsKeys } from "@/services/period";
import type { ExecutiveFilters } from "@/services/dashboard-executivo";

export async function getAdmissoesKpis(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  const prev = previousPeriod(range);

  async function count(start: Date, end: Date) {
    return prisma.movement.count({
      where: {
        type: MovementType.ADMISSAO,
        date: { gte: start, lte: end },
        ...(filters.unitId ? { employee: { unitId: filters.unitId } } : {}),
      },
    });
  }

  const [current, previous] = await Promise.all([count(range.start, range.end), count(prev.start, prev.end)]);

  const months = lastNMonthsKeys(12);
  const series = await Promise.all(
    months.map(async (key) => {
      const [y, m] = key.split("-").map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0, 23, 59, 59);
      return count(start, end);
    })
  );

  // qualidade de contratação: % de admitidos no período que NÃO se desligaram em até 90 dias
  const admitted = await prisma.employee.findMany({
    where: {
      admissionDate: { gte: range.start, lte: range.end },
      ...(filters.unitId ? { unitId: filters.unitId } : {}),
    },
    select: { admissionDate: true, terminationDate: true },
  });

  const earlyExits = admitted.filter((e) => {
    if (!e.terminationDate) return false;
    const days = (e.terminationDate.getTime() - e.admissionDate.getTime()) / 86400000;
    return days <= 90;
  }).length;

  const qualityRate = admitted.length > 0 ? 1 - earlyExits / admitted.length : 1;

  return { current, previous, delta: percentDelta(current, previous), series, qualityRate, totalAdmitted: admitted.length };
}

export async function getAdmissoesByUnit(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  const units = await prisma.unit.findMany({
    select: {
      name: true,
      employees: {
        where: { admissionDate: { gte: range.start, lte: range.end } },
        select: { id: true },
      },
    },
  });
  return units.map((u) => ({ name: u.name, value: u.employees.length })).filter((u) => u.value > 0);
}

export async function getAdmissoesByPosition(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  const positions = await prisma.position.findMany({
    select: {
      name: true,
      employees: {
        where: {
          admissionDate: { gte: range.start, lte: range.end },
          ...(filters.unitId ? { unitId: filters.unitId } : {}),
        },
        select: { id: true },
      },
    },
  });
  return positions
    .map((p) => ({ name: p.name, value: p.employees.length }))
    .filter((p) => p.value > 0)
    .sort((a, b) => b.value - a.value);
}

export async function getAdmissoesTable(filters: ExecutiveFilters) {
  const range = resolvePeriod(filters.period);
  return prisma.employee.findMany({
    where: {
      admissionDate: { gte: range.start, lte: range.end },
      ...(filters.unitId ? { unitId: filters.unitId } : {}),
    },
    include: { position: true, manager: true, unit: true },
    orderBy: { admissionDate: "desc" },
    take: 50,
  });
}
