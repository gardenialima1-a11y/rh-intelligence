import { prisma } from "@/lib/prisma";
import { monthKey } from "@/services/period";

export interface PayrollDetailFilters {
  /** "YYYY-MM". Quando omitido, usa o mês mais recente com dados importados. */
  competenceKey?: string;
  costCenterId?: string;
  secondaryCostCenterId?: string;
  employeeId?: string;
}

export interface PayrollDetailLineItem {
  verba: string;
  descricao: string;
  valor: number;
}

export interface PayrollDetailRow {
  employeeId: string;
  employeeName: string;
  registration: string;
  costCenterName: string | null;
  secondaryCostCenterName: string | null;
  baseSalary: number;
  fgtsValue: number | null;
  /** Soma de todas as linhas com "PERICULOSIDADE" na descrição, ou null se o colaborador não recebe. */
  periculosidadeValue: number | null;
  /** Soma de todas as linhas com "INSALUBRIDADE" na descrição, ou null se o colaborador não recebe. */
  insalubridadeValue: number | null;
  totalProventos: number;
  totalDescontos: number;
  proventos: PayrollDetailLineItem[];
  descontos: PayrollDetailLineItem[];
}

/** Meses (YYYY-MM, mais recente primeiro) que já têm detalhamento de folha importado. */
export async function getAvailableDetailCompetences(): Promise<string[]> {
  const rows = await prisma.payrollLineItem.findMany({
    select: { competence: true },
    distinct: ["competence"],
    orderBy: { competence: "desc" },
  });
  return rows.map((r) => monthKey(r.competence));
}

function competenceKeyToDate(key: string): Date {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

export async function getPayrollDetailReport(filters: PayrollDetailFilters): Promise<{
  competenceKey: string | null;
  rows: PayrollDetailRow[];
}> {
  let competenceKey = filters.competenceKey;
  if (!competenceKey) {
    const available = await getAvailableDetailCompetences();
    competenceKey = available[0];
  }
  if (!competenceKey) return { competenceKey: null, rows: [] };

  const competence = competenceKeyToDate(competenceKey);

  const employeeWhere = {
    ...(filters.costCenterId ? { costCenterId: filters.costCenterId } : {}),
    ...(filters.secondaryCostCenterId ? { secondaryCostCenterId: filters.secondaryCostCenterId } : {}),
    ...(filters.employeeId ? { id: filters.employeeId } : {}),
  };

  const [employees, lineItems, payrollEntries] = await Promise.all([
    prisma.employee.findMany({
      where: employeeWhere,
      select: { id: true, name: true, registration: true, costCenter: { select: { name: true } }, secondaryCostCenter: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.payrollLineItem.findMany({
      where: { competence, ...(Object.keys(employeeWhere).length > 0 ? { employee: employeeWhere } : {}) },
    }),
    prisma.payrollEntry.findMany({
      where: { competence, ...(Object.keys(employeeWhere).length > 0 ? { employee: employeeWhere } : {}) },
      select: { employeeId: true, baseSalary: true, fgtsValue: true },
    }),
  ]);

  const payrollEntryByEmployee = new Map(payrollEntries.map((p) => [p.employeeId, p]));
  const itemsByEmployee = new Map<string, typeof lineItems>();
  for (const item of lineItems) {
    const list = itemsByEmployee.get(item.employeeId) ?? [];
    list.push(item);
    itemsByEmployee.set(item.employeeId, list);
  }

  const rows: PayrollDetailRow[] = employees
    .filter((e) => itemsByEmployee.has(e.id) || payrollEntryByEmployee.has(e.id))
    .map((e) => {
      const items = itemsByEmployee.get(e.id) ?? [];
      const proventos = items.filter((i) => i.tipo === "PROVENTO");
      const descontos = items.filter((i) => i.tipo === "DESCONTO");

      const periculosidadeItems = proventos.filter((i) => /PERICULOSIDADE/i.test(i.descricao));
      const insalubridadeItems = proventos.filter((i) => /INSALUBRIDADE/i.test(i.descricao));

      return {
        employeeId: e.id,
        employeeName: e.name,
        registration: e.registration,
        costCenterName: e.costCenter?.name ?? null,
        secondaryCostCenterName: e.secondaryCostCenter?.name ?? null,
        baseSalary: payrollEntryByEmployee.get(e.id)?.baseSalary ?? 0,
        fgtsValue: payrollEntryByEmployee.get(e.id)?.fgtsValue ?? null,
        periculosidadeValue: periculosidadeItems.length > 0 ? periculosidadeItems.reduce((s, i) => s + i.valor, 0) : null,
        insalubridadeValue: insalubridadeItems.length > 0 ? insalubridadeItems.reduce((s, i) => s + i.valor, 0) : null,
        totalProventos: proventos.reduce((s, i) => s + i.valor, 0),
        totalDescontos: descontos.reduce((s, i) => s + i.valor, 0),
        proventos: proventos.map((i) => ({ verba: i.verba, descricao: i.descricao, valor: i.valor })),
        descontos: descontos.map((i) => ({ verba: i.verba, descricao: i.descricao, valor: i.valor })),
      };
    });

  return { competenceKey, rows };
}

export interface PayrollDetailTotalItem {
  verba: string;
  label: string;
  total: number;
  count: number;
}

/**
 * Remove a parte variável da descrição (nº de parcela e nº do contrato de
 * empréstimo consignado) pra agrupar tudo sob o mesmo rótulo — sem isso,
 * cada empréstimo vira um card diferente ("EMPRÉSTIMO CONSIGNADO 8/36 - C:571",
 * "EMPRÉSTIMO CONSIGNADO 2/12 - C:1432", etc).
 */
function canonicalLabel(descricao: string): string {
  return descricao
    .replace(/\d+\/\d+\s*-\s*C:\d+/gi, "")
    .replace(/-\s*C:\d+/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Totais de cada tipo de provento e desconto (agrupados por verba), pra montar um card por tipo. */
export function getPayrollDetailTotals(rows: PayrollDetailRow[]): {
  proventoTotals: PayrollDetailTotalItem[];
  descontoTotals: PayrollDetailTotalItem[];
} {
  function aggregate(pick: (r: PayrollDetailRow) => PayrollDetailLineItem[]): PayrollDetailTotalItem[] {
    const byVerba = new Map<string, PayrollDetailTotalItem>();
    for (const row of rows) {
      for (const item of pick(row)) {
        const existing = byVerba.get(item.verba);
        if (existing) {
          existing.total += item.valor;
          existing.count += 1;
        } else {
          byVerba.set(item.verba, { verba: item.verba, label: canonicalLabel(item.descricao), total: item.valor, count: 1 });
        }
      }
    }
    return Array.from(byVerba.values()).sort((a, b) => b.total - a.total);
  }

  return {
    proventoTotals: aggregate((r) => r.proventos),
    descontoTotals: aggregate((r) => r.descontos),
  };
}
