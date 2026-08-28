import { prisma } from "@/lib/prisma";
import { resolvePeriod, monthKey, monthLabelsPtBR } from "@/services/period";
import type { ExecutiveFilters } from "@/services/dashboard-executivo";
import {
  resolveHourlyRate,
  matchFaltaDeduction,
  classifyFaltaCruzamento,
  type TaxaHorariaFonte,
  type FaltaCruzamentoStatus,
} from "@/lib/analytics/custo-atestado";

/**
 * Cruzamento "Ponto x Folha de Pagamento" do módulo de Absenteísmo — pedido
 * estratégico de RH: (1) quanto cada atestado médico custou de verdade pra
 * empresa, usando o salário REAL lançado na folha (não uma estimativa por
 * faixa de cargo) sempre que esse dado existir; e (2) quais faltas
 * injustificadas realmente geraram desconto na folha — uma falta sem desconto
 * correspondente pode ter sido negociada com o gestor (banco de horas, folga
 * compensada, etc.) e por isso não deve ser tratada como injustificada de
 * verdade nem entrar como custo.
 */

function competenceDateFromKey(key: string): Date {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

async function fallbackMonthlySalary(): Promise<number> {
  const positions = await prisma.position.findMany({
    where: { salaryFloor: { not: null } },
    select: { salaryFloor: true, salaryCeil: true },
  });
  if (positions.length === 0) return 0;
  return (
    positions.reduce((sum, p) => sum + ((p.salaryFloor ?? 0) + (p.salaryCeil ?? p.salaryFloor ?? 0)) / 2, 0) /
    positions.length
  );
}

function employeeScopeWhere(filters: ExecutiveFilters) {
  return {
    ...(filters.unitId ? { unitId: filters.unitId } : {}),
    ...(filters.costCenterId ? { costCenterId: filters.costCenterId } : {}),
    ...(filters.secondaryCostCenterId ? { secondaryCostCenterId: filters.secondaryCostCenterId } : {}),
  };
}

// ----------------------------------------------------------------------------
// 1) Custo real de atestados médicos
// ----------------------------------------------------------------------------

export interface AtestadoCustoRow {
  absenceId: string;
  employeeId: string;
  employeeName: string;
  registration: string;
  costCenterName: string | null;
  secondaryCostCenterName: string | null;
  date: Date;
  mesKey: string;
  hoursLost: number;
  hourlyRate: number;
  rateSource: TaxaHorariaFonte;
  cost: number;
  cid: string | null;
}

/**
 * Uma linha por ocorrência de atestado (Absence.hasCertificate = true) no
 * período, com o custo calculado pela melhor fonte de salário disponível
 * (folha real do mês > faixa do cargo > média das faixas). Base de tudo que
 * é agrupado por pessoa/setor/mês nas funções abaixo.
 */
export async function getCustoRealAtestados(filters: ExecutiveFilters): Promise<AtestadoCustoRow[]> {
  const range = resolvePeriod(filters.period);
  const scope = employeeScopeWhere(filters);

  const absences = await prisma.absence.findMany({
    where: {
      hasCertificate: true,
      date: { gte: range.start, lte: range.end },
      ...(Object.keys(scope).length > 0 ? { employee: scope } : {}),
    },
    select: {
      id: true,
      date: true,
      hoursLost: true,
      cid: true,
      employeeId: true,
      employee: {
        select: {
          name: true,
          registration: true,
          costCenter: { select: { name: true } },
          secondaryCostCenter: { select: { name: true } },
          position: { select: { salaryFloor: true, salaryCeil: true } },
        },
      },
    },
    orderBy: { date: "desc" },
  });

  if (absences.length === 0) return [];

  const employeeIds = Array.from(new Set(absences.map((a) => a.employeeId)));
  const monthKeys = Array.from(new Set(absences.map((a) => monthKey(a.date))));
  const competenceDates = monthKeys.map(competenceDateFromKey);

  const [payrollEntries, fallbackSalary] = await Promise.all([
    prisma.payrollEntry.findMany({
      where: { employeeId: { in: employeeIds }, competence: { in: competenceDates } },
      select: { employeeId: true, competence: true, baseSalary: true },
    }),
    fallbackMonthlySalary(),
  ]);

  const realSalaryByKey = new Map(payrollEntries.map((p) => [`${p.employeeId}_${monthKey(p.competence)}`, p.baseSalary]));

  return absences.map((a) => {
    const mesKey = monthKey(a.date);
    const realMonthlySalary = realSalaryByKey.get(`${a.employeeId}_${mesKey}`) ?? null;
    const { rate, source } = resolveHourlyRate({
      realMonthlySalary,
      positionFloor: a.employee.position?.salaryFloor ?? null,
      positionCeil: a.employee.position?.salaryCeil ?? null,
      fallbackMonthlySalary: fallbackSalary,
    });

    return {
      absenceId: a.id,
      employeeId: a.employeeId,
      employeeName: a.employee.name,
      registration: a.employee.registration,
      costCenterName: a.employee.costCenter?.name ?? null,
      secondaryCostCenterName: a.employee.secondaryCostCenter?.name ?? null,
      date: a.date,
      mesKey,
      hoursLost: a.hoursLost,
      hourlyRate: rate,
      rateSource: source,
      cost: a.hoursLost * rate,
      cid: a.cid,
    };
  });
}

export interface CustoAtestadoResumoPessoa {
  employeeId: string;
  employeeName: string;
  registration: string;
  setor: string | null;
  ocorrencias: number;
  hoursLost: number;
  cost: number;
  /** true quando parte do custo dessa pessoa usou aproximação (sem salário real da folha naquele mês). */
  usaAproximacao: boolean;
}

/** Agrupa por colaborador — usado na tabela "Custo real de atestados por colaborador". */
export function resumoCustoAtestadoPorPessoa(rows: AtestadoCustoRow[]): CustoAtestadoResumoPessoa[] {
  const map = new Map<string, CustoAtestadoResumoPessoa>();
  for (const r of rows) {
    const cur = map.get(r.employeeId) ?? {
      employeeId: r.employeeId,
      employeeName: r.employeeName,
      registration: r.registration,
      setor: r.costCenterName,
      ocorrencias: 0,
      hoursLost: 0,
      cost: 0,
      usaAproximacao: false,
    };
    cur.ocorrencias += 1;
    cur.hoursLost += r.hoursLost;
    cur.cost += r.cost;
    if (r.rateSource !== "FOLHA_REAL") cur.usaAproximacao = true;
    map.set(r.employeeId, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
}

export interface CustoAtestadoResumoSetor {
  setor: string;
  ocorrencias: number;
  hoursLost: number;
  cost: number;
}

/** Agrupa por setor (principal ou secundário) — usado no ranking gerencial. */
export function resumoCustoAtestadoPorSetor(
  rows: AtestadoCustoRow[],
  campo: "costCenterName" | "secondaryCostCenterName" = "costCenterName"
): CustoAtestadoResumoSetor[] {
  const map = new Map<string, CustoAtestadoResumoSetor>();
  for (const r of rows) {
    const valor = r[campo];
    if (campo === "secondaryCostCenterName" && !valor) continue;
    const setor = valor ?? "Sem centro de custo";
    const cur = map.get(setor) ?? { setor, ocorrencias: 0, hoursLost: 0, cost: 0 };
    cur.ocorrencias += 1;
    cur.hoursLost += r.hoursLost;
    cur.cost += r.cost;
    map.set(setor, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.cost - a.cost);
}

export interface CustoAtestadoResumoMes {
  mesKey: string;
  label: string;
  ocorrencias: number;
  hoursLost: number;
  cost: number;
}

/** Agrupa por mês — usado no filtro/série temporal da tabela detalhada. */
export function resumoCustoAtestadoPorMes(rows: AtestadoCustoRow[]): CustoAtestadoResumoMes[] {
  const map = new Map<string, CustoAtestadoResumoMes>();
  for (const r of rows) {
    const cur = map.get(r.mesKey) ?? { mesKey: r.mesKey, label: monthLabelsPtBR([r.mesKey])[0], ocorrencias: 0, hoursLost: 0, cost: 0 };
    cur.ocorrencias += 1;
    cur.hoursLost += r.hoursLost;
    cur.cost += r.cost;
    map.set(r.mesKey, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.mesKey.localeCompare(a.mesKey));
}

// ----------------------------------------------------------------------------
// 2) Faltas injustificadas cruzadas com desconto na folha
// ----------------------------------------------------------------------------

export interface FaltaCruzadaRow {
  employeeId: string;
  employeeName: string;
  registration: string;
  costCenterName: string | null;
  secondaryCostCenterName: string | null;
  mesKey: string;
  ocorrencias: number;
  hoursLost: number;
  dates: Date[];
  status: FaltaCruzamentoStatus;
  valorDescontado: number | null;
  motivoDesconto: string | null;
}

/**
 * Uma linha por colaborador/mês com pelo menos uma falta (status FALTOU no
 * ponto) no período. O desconto na folha é lançado por mês (não por dia), por
 * isso o cruzamento é feito nesse nível — evita contar o mesmo desconto
 * mensal várias vezes se a pessoa faltou mais de um dia no mês.
 */
export async function getFaltasInjustificadasCruzadas(filters: ExecutiveFilters): Promise<FaltaCruzadaRow[]> {
  const range = resolvePeriod(filters.period);
  const scope = employeeScopeWhere(filters);

  const records = await prisma.attendanceRecord.findMany({
    where: {
      status: "FALTOU",
      date: { gte: range.start, lte: range.end },
      ...(Object.keys(scope).length > 0 ? { employee: scope } : {}),
    },
    select: {
      employeeId: true,
      date: true,
      employee: {
        select: {
          name: true,
          registration: true,
          costCenter: { select: { name: true } },
          secondaryCostCenter: { select: { name: true } },
        },
      },
    },
  });

  if (records.length === 0) return [];

  const employeeIds = Array.from(new Set(records.map((r) => r.employeeId)));
  const monthKeys = Array.from(new Set(records.map((r) => monthKey(r.date))));
  const competenceDates = monthKeys.map(competenceDateFromKey);

  const [absences, lineItems] = await Promise.all([
    prisma.absence.findMany({
      where: { employeeId: { in: employeeIds }, date: { gte: range.start, lte: range.end } },
      select: { employeeId: true, date: true, hoursLost: true },
    }),
    prisma.payrollLineItem.findMany({
      where: { employeeId: { in: employeeIds }, competence: { in: competenceDates } },
      select: { employeeId: true, competence: true, tipo: true, descricao: true, valor: true },
    }),
  ]);

  const hoursByDay = new Map(absences.map((a) => [`${a.employeeId}_${a.date.toISOString().slice(0, 10)}`, a.hoursLost]));

  const hasPayrollDetail = new Set<string>();
  const descontosByKey = new Map<string, { descricao: string; valor: number }[]>();
  for (const item of lineItems) {
    const key = `${item.employeeId}_${monthKey(item.competence)}`;
    hasPayrollDetail.add(key);
    if (item.tipo === "DESCONTO") {
      const list = descontosByKey.get(key) ?? [];
      list.push({ descricao: item.descricao, valor: item.valor });
      descontosByKey.set(key, list);
    }
  }

  // Agrupa os dias de falta por colaborador/mês antes de classificar.
  const grouped = new Map<
    string,
    { employeeId: string; employeeName: string; registration: string; costCenterName: string | null; secondaryCostCenterName: string | null; mesKey: string; dates: Date[]; hoursLost: number }
  >();
  for (const r of records) {
    const mesKey = monthKey(r.date);
    const key = `${r.employeeId}_${mesKey}`;
    const cur = grouped.get(key) ?? {
      employeeId: r.employeeId,
      employeeName: r.employee.name,
      registration: r.employee.registration,
      costCenterName: r.employee.costCenter?.name ?? null,
      secondaryCostCenterName: r.employee.secondaryCostCenter?.name ?? null,
      mesKey,
      dates: [],
      hoursLost: 0,
    };
    cur.dates.push(r.date);
    cur.hoursLost += hoursByDay.get(`${r.employeeId}_${r.date.toISOString().slice(0, 10)}`) ?? 0;
    grouped.set(key, cur);
  }

  return Array.from(grouped.values()).map((g) => {
    const key = `${g.employeeId}_${g.mesKey}`;
    const hasDetail = hasPayrollDetail.has(key);
    const descontos = descontosByKey.get(key) ?? [];
    const match = matchFaltaDeduction(descontos);
    const status = classifyFaltaCruzamento(hasDetail, match);

    return {
      employeeId: g.employeeId,
      employeeName: g.employeeName,
      registration: g.registration,
      costCenterName: g.costCenterName,
      secondaryCostCenterName: g.secondaryCostCenterName,
      mesKey: g.mesKey,
      ocorrencias: g.dates.length,
      hoursLost: g.hoursLost,
      dates: g.dates.sort((a, b) => a.getTime() - b.getTime()),
      status,
      valorDescontado: status === "CONFIRMADA" ? match.totalValor : null,
      motivoDesconto: status === "CONFIRMADA" ? match.items.map((i) => i.descricao).join("; ") : null,
    };
  });
}

export interface FaltaCruzadaResumo {
  key: string;
  label: string;
  ocorrenciasConfirmadas: number;
  ocorrenciasAbonadas: number;
  ocorrenciasIndeterminadas: number;
  custoConfirmado: number;
}

function baseResumo(key: string, label: string): FaltaCruzadaResumo {
  return { key, label, ocorrenciasConfirmadas: 0, ocorrenciasAbonadas: 0, ocorrenciasIndeterminadas: 0, custoConfirmado: 0 };
}

function acumula(resumo: FaltaCruzadaResumo, r: FaltaCruzadaRow) {
  if (r.status === "CONFIRMADA") {
    resumo.ocorrenciasConfirmadas += r.ocorrencias;
    resumo.custoConfirmado += r.valorDescontado ?? 0;
  } else if (r.status === "ABONADA") {
    resumo.ocorrenciasAbonadas += r.ocorrencias;
  } else {
    resumo.ocorrenciasIndeterminadas += r.ocorrencias;
  }
}

/** Agrupa por colaborador — mostra o total confirmado, abonado e indeterminado de cada pessoa no período. */
export function resumoFaltasCruzadasPorPessoa(rows: FaltaCruzadaRow[]): (FaltaCruzadaResumo & { setor: string | null })[] {
  const map = new Map<string, FaltaCruzadaResumo & { setor: string | null }>();
  for (const r of rows) {
    const cur = map.get(r.employeeId) ?? { ...baseResumo(r.employeeId, r.employeeName), setor: r.costCenterName };
    acumula(cur, r);
    map.set(r.employeeId, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.ocorrenciasConfirmadas - a.ocorrenciasConfirmadas || b.custoConfirmado - a.custoConfirmado);
}

/** Agrupa por setor (principal ou secundário) — só considera ocorrências CONFIRMADAS e ABONADAS/INDETERMINADAS separadamente, sem inflar o setor com faltas que podem ter sido acordadas. */
export function resumoFaltasCruzadasPorSetor(
  rows: FaltaCruzadaRow[],
  campo: "costCenterName" | "secondaryCostCenterName" = "costCenterName"
): FaltaCruzadaResumo[] {
  const map = new Map<string, FaltaCruzadaResumo>();
  for (const r of rows) {
    const valor = r[campo];
    if (campo === "secondaryCostCenterName" && !valor) continue;
    const setor = valor ?? "Sem centro de custo";
    const cur = map.get(setor) ?? baseResumo(setor, setor);
    acumula(cur, r);
    map.set(setor, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.ocorrenciasConfirmadas - a.ocorrenciasConfirmadas);
}

/** Agrupa por mês — dá a visão de evolução do total confirmado x abonado x indeterminado. */
export function resumoFaltasCruzadasPorMes(rows: FaltaCruzadaRow[]): FaltaCruzadaResumo[] {
  const map = new Map<string, FaltaCruzadaResumo>();
  for (const r of rows) {
    const cur = map.get(r.mesKey) ?? baseResumo(r.mesKey, monthLabelsPtBR([r.mesKey])[0]);
    acumula(cur, r);
    map.set(r.mesKey, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
}
