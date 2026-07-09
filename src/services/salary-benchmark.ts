import { prisma } from "@/lib/prisma";

export interface BenchmarkRow {
  positionId: string;
  positionName: string;
  companyAvgSalary: number | null;
  employeeCount: number;
  marketMinSalary: number | null;
  marketAvgSalary: number | null;
  marketMaxSalary: number | null;
  gapPercent: number | null;
  source: string | null;
  referenceDate: Date | null;
}

/**
 * Compara o salário médio pago pela empresa (última competência de folha) com a
 * referência de mercado cadastrada em SalaryBenchmark. Não é uma integração ao
 * vivo — os valores de mercado são inseridos manualmente e sempre exibidos com
 * fonte e data.
 */
export async function getSalaryBenchmarkComparison(): Promise<BenchmarkRow[]> {
  const positions = await prisma.position.findMany({
    include: {
      benchmark: true,
      employees: {
        where: { isActive: true },
        select: {
          payrolls: { orderBy: { competence: "desc" }, take: 1, select: { baseSalary: true } },
        },
      },
    },
  });

  return positions
    .map((p) => {
      const salaries = p.employees.flatMap((e) => e.payrolls.map((pr) => pr.baseSalary));
      const companyAvgSalary = salaries.length > 0 ? salaries.reduce((a, b) => a + b, 0) / salaries.length : null;
      const marketAvg = p.benchmark?.marketAvgSalary ?? null;
      const gapPercent = companyAvgSalary !== null && marketAvg ? ((companyAvgSalary - marketAvg) / marketAvg) * 100 : null;

      return {
        positionId: p.id,
        positionName: p.name,
        companyAvgSalary,
        employeeCount: salaries.length,
        marketMinSalary: p.benchmark?.marketMinSalary ?? null,
        marketAvgSalary: marketAvg,
        marketMaxSalary: p.benchmark?.marketMaxSalary ?? null,
        gapPercent,
        source: p.benchmark?.source ?? null,
        referenceDate: p.benchmark?.referenceDate ?? null,
      };
    })
    .filter((r) => r.employeeCount > 0 || r.marketAvgSalary !== null)
    .sort((a, b) => (a.gapPercent ?? 999) - (b.gapPercent ?? 999));
}

export async function getBenchmarkSummary() {
  const rows = await getSalaryBenchmarkComparison();
  const comparable = rows.filter((r) => r.gapPercent !== null);
  const belowMarket = comparable.filter((r) => (r.gapPercent ?? 0) < -5);
  const aboveMarket = comparable.filter((r) => (r.gapPercent ?? 0) > 5);
  const avgGap = comparable.length > 0 ? comparable.reduce((acc, r) => acc + (r.gapPercent ?? 0), 0) / comparable.length : 0;

  return {
    positionsComparable: comparable.length,
    positionsBelowMarket: belowMarket.length,
    positionsAboveMarket: aboveMarket.length,
    avgGapPercent: avgGap,
  };
}
