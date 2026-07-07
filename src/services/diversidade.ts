import { prisma } from "@/lib/prisma";
import type { ExecutiveFilters } from "@/services/dashboard-executivo";

export async function getDiversidadeKpis(filters: ExecutiveFilters) {
  const where = { isActive: true, ...(filters.unitId ? { unitId: filters.unitId } : {}) };

  const [total, women, pcd, apprentices] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.count({ where: { ...where, gender: "FEMININO" } }),
    prisma.employee.count({ where: { ...where, isPCD: true } }),
    prisma.employee.count({ where: { ...where, contractType: "APRENDIZ" } }),
  ]);

  const womenInLeadership = await prisma.employee.count({
    where: { ...where, gender: "FEMININO", position: { level: { in: ["Liderança", "Gerência"] } } },
  });
  const totalLeadership = await prisma.employee.count({
    where: { ...where, position: { level: { in: ["Liderança", "Gerência"] } } },
  });

  return {
    total,
    womenRate: total > 0 ? women / total : 0,
    pcdRate: total > 0 ? pcd / total : 0,
    pcdLegalTarget: 0.05,
    apprenticeRate: total > 0 ? apprentices / total : 0,
    apprenticeLegalTarget: 0.05,
    womenInLeadershipRate: totalLeadership > 0 ? womenInLeadership / totalLeadership : 0,
  };
}

export async function getGenderByArea(filters: ExecutiveFilters) {
  const costCenters = await prisma.costCenter.findMany({
    select: {
      name: true,
      employees: {
        where: { isActive: true, gender: "FEMININO", ...(filters.unitId ? { unitId: filters.unitId } : {}) },
        select: { id: true },
      },
    },
  });
  return costCenters.map((c) => ({ name: c.name, value: c.employees.length }));
}

export interface PayEquityRow {
  position: string;
  avgMale: number | null;
  avgFemale: number | null;
  gapPercent: number | null; // positivo = mulheres ganham menos que homens
  headcountMale: number;
  headcountFemale: number;
}

/**
 * Equidade salarial por cargo (gender pay gap) — indicador padrão de
 * consultorias de RH estratégico (Mercer, WTW) e cada vez mais exigido
 * por legislação de transparência salarial (ex.: Lei 14.611/2023 no Brasil).
 * gapPercent > 0 indica que mulheres recebem, em média, menos que homens no mesmo cargo.
 */
export async function getPayEquityByPosition(filters: ExecutiveFilters): Promise<PayEquityRow[]> {
  const positions = await prisma.position.findMany({
    select: {
      name: true,
      employees: {
        where: { isActive: true, ...(filters.unitId ? { unitId: filters.unitId } : {}) },
        select: {
          gender: true,
          payrolls: { orderBy: { competence: "desc" }, take: 1, select: { baseSalary: true } },
        },
      },
    },
  });

  const rows: PayEquityRow[] = [];
  for (const p of positions) {
    const maleSalaries = p.employees
      .filter((e) => e.gender === "MASCULINO")
      .flatMap((e) => e.payrolls.map((pr) => pr.baseSalary));
    const femaleSalaries = p.employees
      .filter((e) => e.gender === "FEMININO")
      .flatMap((e) => e.payrolls.map((pr) => pr.baseSalary));

    if (maleSalaries.length === 0 && femaleSalaries.length === 0) continue;

    const avgMale = maleSalaries.length > 0 ? maleSalaries.reduce((a, b) => a + b, 0) / maleSalaries.length : null;
    const avgFemale = femaleSalaries.length > 0 ? femaleSalaries.reduce((a, b) => a + b, 0) / femaleSalaries.length : null;
    const gapPercent = avgMale && avgFemale ? ((avgMale - avgFemale) / avgMale) * 100 : null;

    rows.push({
      position: p.name,
      avgMale,
      avgFemale,
      gapPercent,
      headcountMale: maleSalaries.length,
      headcountFemale: femaleSalaries.length,
    });
  }

  return rows.sort((a, b) => Math.abs(b.gapPercent ?? 0) - Math.abs(a.gapPercent ?? 0));
}

export async function getOverallPayGap(filters: ExecutiveFilters) {
  const rows = await getPayEquityByPosition(filters);
  const comparable = rows.filter((r) => r.gapPercent !== null);
  if (comparable.length === 0) return { overallGapPercent: 0, positionsAnalyzed: 0, positionsWithGap: 0 };

  const overallGapPercent = comparable.reduce((acc, r) => acc + (r.gapPercent ?? 0), 0) / comparable.length;
  const positionsWithGap = comparable.filter((r) => (r.gapPercent ?? 0) > 5).length;

  return { overallGapPercent, positionsAnalyzed: comparable.length, positionsWithGap };
}

export async function getAgeDistribution(filters: ExecutiveFilters) {
  const employees = await prisma.employee.findMany({
    where: { isActive: true, ...(filters.unitId ? { unitId: filters.unitId } : {}) },
    select: { birthDate: true },
  });
  const buckets = ["18-24", "25-34", "35-44", "45-54", "55+"];
  const counts = [0, 0, 0, 0, 0];
  const now = new Date();
  for (const e of employees) {
    if (!e.birthDate) continue;
    const age = now.getFullYear() - e.birthDate.getFullYear();
    const idx = age < 25 ? 0 : age < 35 ? 1 : age < 45 ? 2 : age < 55 ? 3 : 4;
    counts[idx] += 1;
  }
  return buckets.map((label, i) => ({ name: label, value: counts[i] }));
}
