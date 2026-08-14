import { prisma } from "@/lib/prisma";
import { MovementType } from "@prisma/client";
import { monthKey } from "@/services/period";
import { formatCurrency } from "@/lib/utils";
import { activePresentEmployeeWhere } from "@/lib/employee-filters";

const OVERTIME_VERBAS = new Set(["150", "200", "357"]);
const BASE_SALARY_VERBAS = new Set(["1", "5"]); // SALARIO MENSAL, SALARIO JOVEM APRENDIZ

export interface CostInsightAdmissao {
  employeeName: string;
  costCenterName: string | null;
  valor: number;
}

export interface CostInsightSaida {
  employeeName: string;
  costCenterName: string | null;
  valorAnterior: number;
  virouRescisao: boolean;
  /** Estava afastado pelo INSS durante o mês atual — explica a ausência na folha sem ser desligamento. */
  afastadoINSS: boolean;
}

export interface CostInsightReajuste {
  employeeName: string;
  costCenterName: string | null;
  salarioAnterior: number;
  salarioAtual: number;
  delta: number;
}

export interface CostInsightGroupDelta {
  label: string;
  anterior: number;
  atual: number;
  delta: number;
}

/**
 * Compara admissões x saídas por centro de custo (secundário — mesmo campo
 * usado no "Quadro Ideal x Real" do módulo Headcount) com o quadro ideal
 * cadastrado, pra dizer se as admissões daquele setor foram só reposição
 * (substituição de quem saiu) ou aumento real de quadro.
 */
export interface CostInsightHeadcountSector {
  costCenterId: string;
  costCenterName: string;
  admissoesCount: number;
  admissoesValor: number;
  saidasCount: number;
  netChange: number; // admissoesCount - saidasCount no período
  idealHeadcount: number | null;
  realHeadcountAtual: number;
  diagnostico: "substituicao" | "crescimento" | "reducao" | "sem_meta";
  situacaoQuadro: "acima_do_ideal" | "abaixo_do_ideal" | "no_ideal" | "sem_meta";
}

export interface CostInsightsResult {
  currentCompetence: string | null;
  previousCompetence: string | null;
  hasPreviousData: boolean;
  totalCurrent: number;
  totalPrevious: number;
  delta: number;
  deltaPercent: number | null;
  narrative: string[];
  admissoes: CostInsightAdmissao[];
  saidas: CostInsightSaida[];
  reajustes: CostInsightReajuste[];
  horasExtrasByCostCenter: CostInsightGroupDelta[];
  outrosProventos: CostInsightGroupDelta[];
  beneficiosExtra: CostInsightGroupDelta[];
  headcountBySector: CostInsightHeadcountSector[];
}

function competenceKeyToDate(key: string): Date {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

/** "2026-07" -> "julho/2026". */
export function formatMonthNamePtBR(key: string): string {
  const fmt = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
  return fmt.format(competenceKeyToDate(key));
}

function previousCompetenceKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 2, 1); // m já é 1-indexado; m-2 volta um mês
  return monthKey(d);
}

/** Todos os meses (YYYY-MM, mais recente primeiro) com algum dado de custo lançado — pros dois seletores de mês da tela de insights. Exclui o mês corrente (hoje) de propósito: a folha desse mês normalmente ainda não fechou, então comparar com ele dá uma leitura errada. */
export async function getAvailableInsightsCompetences(): Promise<string[]> {
  const [payrollMonths, extraBenefitMonths] = await Promise.all([
    prisma.payrollEntry.findMany({ select: { competence: true }, distinct: ["competence"] }),
    prisma.extraBenefit.findMany({ select: { competence: true }, distinct: ["competence"] }),
  ]);
  const currentMonthKey = monthKey(new Date());
  const keys = new Set(
    [...payrollMonths, ...extraBenefitMonths]
      .map((r) => monthKey(r.competence))
      .filter((k) => k < currentMonthKey)
  );
  return Array.from(keys).sort((a, b) => (a < b ? 1 : -1));
}

/**
 * Compara o custo de pessoal de dois meses quaisquer (não precisam ser
 * consecutivos — ex.: janeiro vs abril) e decompõe a diferença: quanto veio
 * de admissão, de desligamento (que agora vira rescisão, não folha), de
 * reajuste salarial, de variação de hora extra por centro de custo, de
 * outros proventos e de benefícios pagos fora da folha. Gera também uma
 * lista de frases prontas (narrative) com o resumo, da maior pra menor
 * variação.
 *
 * Quando `compareCompetenceKeyInput` não é informado, usa o mês
 * imediatamente anterior ao mês atual (comportamento padrão de antes).
 */
export async function getCostInsights(
  competenceKeyInput?: string,
  compareCompetenceKeyInput?: string
): Promise<CostInsightsResult> {
  const currentCompetence = competenceKeyInput ?? (await getAvailableInsightsCompetences())[0] ?? null;

  if (!currentCompetence) {
    return {
      currentCompetence: null,
      previousCompetence: null,
      hasPreviousData: false,
      totalCurrent: 0,
      totalPrevious: 0,
      delta: 0,
      deltaPercent: null,
      narrative: ["Nenhum mês com folha importada ainda — os insights aparecem depois da primeira importação."],
      admissoes: [],
      saidas: [],
      reajustes: [],
      horasExtrasByCostCenter: [],
      outrosProventos: [],
      beneficiosExtra: [],
      headcountBySector: [],
    };
  }

  const previousCompetence = compareCompetenceKeyInput ?? previousCompetenceKey(currentCompetence);
  const current = competenceKeyToDate(currentCompetence);
  const previous = competenceKeyToDate(previousCompetence);

  const employeeSelect = {
    id: true,
    name: true,
    costCenter: { select: { name: true } },
    secondaryCostCenter: { select: { id: true, name: true, targetHeadcount: true } },
  } as const;

  const [
    currentEntries,
    previousEntries,
    currentLineItems,
    previousLineItems,
    currentExtraBenefits,
    previousExtraBenefits,
    currentTerminations,
    currentInssLeaves,
  ] = await Promise.all([
    prisma.payrollEntry.findMany({ where: { competence: current }, select: { employeeId: true, baseSalary: true, totalCost: true, employee: { select: employeeSelect } } }),
    prisma.payrollEntry.findMany({ where: { competence: previous }, select: { employeeId: true, baseSalary: true, totalCost: true, employee: { select: employeeSelect } } }),
    prisma.payrollLineItem.findMany({ where: { competence: current, tipo: "PROVENTO" }, select: { employeeId: true, verba: true, descricao: true, valor: true, employee: { select: employeeSelect } } }),
    prisma.payrollLineItem.findMany({ where: { competence: previous, tipo: "PROVENTO" }, select: { employeeId: true, verba: true, descricao: true, valor: true, employee: { select: employeeSelect } } }),
    prisma.extraBenefit.findMany({ where: { competence: current }, select: { categoria: true, valor: true } }),
    prisma.extraBenefit.findMany({ where: { competence: previous }, select: { categoria: true, valor: true } }),
    prisma.movement.findMany({ where: { type: MovementType.DESLIGAMENTO, date: { gte: current, lt: new Date(current.getFullYear(), current.getMonth() + 1, 1) } }, select: { employeeId: true } }),
    // Afastamento que estava em curso em algum momento do mês atual: começou antes do fim do mês
    // e (ainda não voltou) ou (só voltou depois do início do mês).
    prisma.inssLeave.findMany({
      where: {
        startDate: { lt: new Date(current.getFullYear(), current.getMonth() + 1, 1) },
        OR: [{ actualReturnDate: null }, { actualReturnDate: { gte: current } }],
      },
      select: { employeeId: true },
    }),
  ]);

  const hasPreviousData = previousEntries.length > 0;

  const currentById = new Map(currentEntries.map((e) => [e.employeeId, e]));
  const previousById = new Map(previousEntries.map((e) => [e.employeeId, e]));

  const totalCurrentPayroll = currentEntries.reduce((s, e) => s + e.totalCost, 0);
  const totalPreviousPayroll = previousEntries.reduce((s, e) => s + e.totalCost, 0);
  const totalCurrentExtra = currentExtraBenefits.reduce((s, e) => s + e.valor, 0);
  const totalPreviousExtra = previousExtraBenefits.reduce((s, e) => s + e.valor, 0);

  const totalCurrent = totalCurrentPayroll + totalCurrentExtra;
  const totalPrevious = totalPreviousPayroll + totalPreviousExtra;
  const delta = totalCurrent - totalPrevious;
  const deltaPercent = totalPrevious > 0 ? delta / totalPrevious : null;

  // --- Admissões (na folha atual, não estavam na anterior) ---
  const terminatedThisMonth = new Set(currentTerminations.map((t) => t.employeeId));
  const admissoes: CostInsightAdmissao[] = [];
  for (const [id, entry] of currentById) {
    if (!previousById.has(id)) {
      admissoes.push({
        employeeName: entry.employee.name,
        costCenterName: entry.employee.costCenter?.name ?? null,
        valor: entry.totalCost,
      });
    }
  }
  admissoes.sort((a, b) => b.valor - a.valor);

  // --- Saídas (estavam na folha anterior, não estão na atual) ---
  const employeesOnInssLeave = new Set(currentInssLeaves.map((l) => l.employeeId));
  const saidas: CostInsightSaida[] = [];
  for (const [id, entry] of previousById) {
    if (!currentById.has(id)) {
      saidas.push({
        employeeName: entry.employee.name,
        costCenterName: entry.employee.costCenter?.name ?? null,
        valorAnterior: entry.totalCost,
        virouRescisao: terminatedThisMonth.has(id),
        afastadoINSS: employeesOnInssLeave.has(id),
      });
    }
  }
  saidas.sort((a, b) => b.valorAnterior - a.valorAnterior);

  // --- Admissões x saídas por centro de custo, comparado com o quadro ideal ---
  // Usa o centro de custo SECUNDÁRIO — é o mesmo campo que o módulo Headcount usa
  // no "Quadro Ideal x Real", então a comparação fica consistente entre as duas telas.
  interface SectorAgg {
    costCenterId: string;
    costCenterName: string;
    admissoesCount: number;
    admissoesValor: number;
    saidasCount: number;
    idealHeadcount: number | null;
  }
  const sectorMap = new Map<string, SectorAgg>();

  for (const [id, entry] of currentById) {
    if (previousById.has(id)) continue; // só quem é admissão nova
    const sc = entry.employee.secondaryCostCenter;
    if (!sc) continue; // sem centro de custo secundário cadastrado, não dá pra comparar com quadro ideal
    const agg = sectorMap.get(sc.id) ?? {
      costCenterId: sc.id,
      costCenterName: sc.name,
      admissoesCount: 0,
      admissoesValor: 0,
      saidasCount: 0,
      idealHeadcount: sc.targetHeadcount,
    };
    agg.admissoesCount += 1;
    agg.admissoesValor += entry.totalCost;
    sectorMap.set(sc.id, agg);
  }
  for (const [id, entry] of previousById) {
    if (currentById.has(id)) continue; // só quem saiu
    const sc = entry.employee.secondaryCostCenter;
    if (!sc) continue;
    const agg = sectorMap.get(sc.id) ?? {
      costCenterId: sc.id,
      costCenterName: sc.name,
      admissoesCount: 0,
      admissoesValor: 0,
      saidasCount: 0,
      idealHeadcount: sc.targetHeadcount,
    };
    agg.saidasCount += 1;
    sectorMap.set(sc.id, agg);
  }

  const sectorIds = Array.from(sectorMap.keys());
  const realHeadcounts =
    sectorIds.length > 0
      ? await Promise.all(
          sectorIds.map((id) => prisma.employee.count({ where: { secondaryCostCenterId: id, ...activePresentEmployeeWhere() } }))
        )
      : [];
  const realHeadcountById = new Map(sectorIds.map((id, i) => [id, realHeadcounts[i]]));

  const headcountBySector: CostInsightHeadcountSector[] = Array.from(sectorMap.values())
    .filter((s) => s.admissoesCount > 0) // essa seção é sobre explicar admissões — setores só com saída não entram aqui
    .map((s) => {
      const netChange = s.admissoesCount - s.saidasCount;
      const realHeadcountAtual = realHeadcountById.get(s.costCenterId) ?? 0;
      const diagnostico: CostInsightHeadcountSector["diagnostico"] =
        netChange === 0 ? "substituicao" : netChange > 0 ? "crescimento" : "reducao";
      const situacaoQuadro: CostInsightHeadcountSector["situacaoQuadro"] =
        s.idealHeadcount == null
          ? "sem_meta"
          : realHeadcountAtual > s.idealHeadcount
            ? "acima_do_ideal"
            : realHeadcountAtual < s.idealHeadcount
              ? "abaixo_do_ideal"
              : "no_ideal";
      return {
        costCenterId: s.costCenterId,
        costCenterName: s.costCenterName,
        admissoesCount: s.admissoesCount,
        admissoesValor: Math.round(s.admissoesValor * 100) / 100,
        saidasCount: s.saidasCount,
        netChange,
        idealHeadcount: s.idealHeadcount,
        realHeadcountAtual,
        diagnostico,
        situacaoQuadro,
      };
    })
    .sort((a, b) => b.admissoesCount - a.admissoesCount);

  // --- Reajustes salariais (colaboradores em ambos os meses, salário base mudou) ---
  const reajustes: CostInsightReajuste[] = [];
  for (const [id, curr] of currentById) {
    const prev = previousById.get(id);
    if (!prev) continue;
    const delta = Math.round((curr.baseSalary - prev.baseSalary) * 100) / 100;
    if (Math.abs(delta) >= 0.01) {
      reajustes.push({
        employeeName: curr.employee.name,
        costCenterName: curr.employee.costCenter?.name ?? null,
        salarioAnterior: prev.baseSalary,
        salarioAtual: curr.baseSalary,
        delta,
      });
    }
  }
  reajustes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  // --- Horas extras por centro de custo ---
  function sumOvertimeByCostCenter(items: typeof currentLineItems) {
    const map = new Map<string, number>();
    for (const item of items) {
      if (!OVERTIME_VERBAS.has(item.verba)) continue;
      const cc = item.employee.costCenter?.name ?? "Sem centro de custo";
      map.set(cc, (map.get(cc) ?? 0) + item.valor);
    }
    return map;
  }
  const currOvertimeByCC = sumOvertimeByCostCenter(currentLineItems);
  const prevOvertimeByCC = sumOvertimeByCostCenter(previousLineItems);
  const allCCKeys = new Set([...currOvertimeByCC.keys(), ...prevOvertimeByCC.keys()]);
  const horasExtrasByCostCenter: CostInsightGroupDelta[] = Array.from(allCCKeys)
    .map((label) => {
      const atual = currOvertimeByCC.get(label) ?? 0;
      const anterior = prevOvertimeByCC.get(label) ?? 0;
      return { label, anterior, atual, delta: Math.round((atual - anterior) * 100) / 100 };
    })
    .filter((r) => Math.abs(r.delta) >= 0.01)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  // --- Outros proventos (exclui salário e hora extra, que já têm seção própria) ---
  function canonicalLabel(descricao: string): string {
    return descricao
      .replace(/\d+\/\d+\s*-\s*C:\d+/gi, "")
      .replace(/-\s*C:\d+/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }
  function sumOtherProventosByLabel(items: typeof currentLineItems) {
    const map = new Map<string, number>();
    for (const item of items) {
      if (OVERTIME_VERBAS.has(item.verba) || BASE_SALARY_VERBAS.has(item.verba)) continue;
      const label = canonicalLabel(item.descricao);
      map.set(label, (map.get(label) ?? 0) + item.valor);
    }
    return map;
  }
  const currOtherByLabel = sumOtherProventosByLabel(currentLineItems);
  const prevOtherByLabel = sumOtherProventosByLabel(previousLineItems);
  const allOtherLabels = new Set([...currOtherByLabel.keys(), ...prevOtherByLabel.keys()]);
  const outrosProventos: CostInsightGroupDelta[] = Array.from(allOtherLabels)
    .map((label) => {
      const atual = currOtherByLabel.get(label) ?? 0;
      const anterior = prevOtherByLabel.get(label) ?? 0;
      return { label, anterior, atual, delta: Math.round((atual - anterior) * 100) / 100 };
    })
    .filter((r) => Math.abs(r.delta) >= 0.01)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 10); // só os 10 maiores movimentos, senão vira ruído

  // --- Benefícios extra-folha por categoria ---
  function sumExtraByCategoria(items: { categoria: string; valor: number }[]) {
    const map = new Map<string, number>();
    for (const item of items) map.set(item.categoria, (map.get(item.categoria) ?? 0) + item.valor);
    return map;
  }
  const currExtraByCat = sumExtraByCategoria(currentExtraBenefits);
  const prevExtraByCat = sumExtraByCategoria(previousExtraBenefits);
  const allCatKeys = new Set([...currExtraByCat.keys(), ...prevExtraByCat.keys()]);
  const beneficiosExtra: CostInsightGroupDelta[] = Array.from(allCatKeys)
    .map((label) => {
      const atual = currExtraByCat.get(label) ?? 0;
      const anterior = prevExtraByCat.get(label) ?? 0;
      return { label, anterior, atual, delta: Math.round((atual - anterior) * 100) / 100 };
    })
    .filter((r) => Math.abs(r.delta) >= 0.01)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  // --- Narrativa ---
  const narrative: string[] = [];
  const currLabel = formatMonthNamePtBR(currentCompetence);
  const prevLabel = formatMonthNamePtBR(previousCompetence);

  if (!hasPreviousData) {
    narrative.push(
      `Não há dados importados de ${prevLabel} pra comparar — assim que esse mês também estiver na base, a análise mês a mês fica completa.`
    );
  } else {
    const direction = delta >= 0 ? "subiu" : "caiu";
    const percentText = deltaPercent != null ? ` (${delta >= 0 ? "+" : ""}${(deltaPercent * 100).toFixed(1)}%)` : "";
    narrative.push(`O custo total de pessoal ${direction} ${formatCurrency(Math.abs(delta))}${percentText} de ${prevLabel} pra ${currLabel}, saindo de ${formatCurrency(totalPrevious)} pra ${formatCurrency(totalCurrent)}.`);

    if (admissoes.length > 0) {
      const total = admissoes.reduce((s, a) => s + a.valor, 0);
      narrative.push(`${admissoes.length} admissão(ões) nova(s) na folha adicionaram ${formatCurrency(total)}.`);

      for (const s of headcountBySector) {
        const diagText =
          s.diagnostico === "substituicao"
            ? `pura substituição (${s.saidasCount} saíram, ${s.admissoesCount} entraram — quadro não mudou de tamanho)`
            : s.diagnostico === "crescimento"
              ? `aumento de quadro (${s.netChange > 0 ? "+" : ""}${s.netChange} posição(ões) a mais que antes)`
              : `redução de quadro, mesmo com admissão (${s.netChange} no total)`;
        const situacaoText =
          s.situacaoQuadro === "sem_meta"
            ? "sem quadro ideal cadastrado pra esse setor"
            : s.situacaoQuadro === "no_ideal"
              ? `exatamente no quadro ideal (${s.realHeadcountAtual}/${s.idealHeadcount})`
              : s.situacaoQuadro === "acima_do_ideal"
                ? `acima do quadro ideal (${s.realHeadcountAtual} atual vs. ${s.idealHeadcount} ideal)`
                : `ainda abaixo do quadro ideal (${s.realHeadcountAtual} atual vs. ${s.idealHeadcount} ideal)`;
        narrative.push(
          `${s.costCenterName}: ${s.admissoesCount} admissão(ões) (${formatCurrency(s.admissoesValor)}) — ${diagText}. Hoje está ${situacaoText}.`
        );
      }
    }

    if (saidas.length > 0) {
      const rescisoes = saidas.filter((s) => s.virouRescisao);
      const afastados = saidas.filter((s) => !s.virouRescisao && s.afastadoINSS);
      const outras = saidas.filter((s) => !s.virouRescisao && !s.afastadoINSS);
      const totalRescisoes = rescisoes.reduce((s, a) => s + a.valorAnterior, 0);
      const totalAfastados = afastados.reduce((s, a) => s + a.valorAnterior, 0);
      if (rescisoes.length > 0) {
        narrative.push(
          `${rescisoes.length} desligamento(s) tiraram ${formatCurrency(totalRescisoes)} da folha este mês — esse valor foi para o custo de rescisão, não aparece mais aqui.`
        );
      }
      if (afastados.length > 0) {
        narrative.push(
          `${afastados.length} colaborador(es) estão afastados pelo INSS (${formatCurrency(totalAfastados)} que saíram da folha por causa disso, não por desligamento).`
        );
      }
      if (outras.length > 0) {
        const totalOutras = outras.reduce((s, a) => s + a.valorAnterior, 0);
        narrative.push(
          `${outras.length} colaborador(es) que estavam na folha de ${prevLabel} não aparecem em ${currLabel} sem ter um desligamento ou afastamento pelo INSS registrado (${formatCurrency(totalOutras)}) — vale conferir se foi esquecido na importação ou se falta lançar o desligamento/afastamento.`
        );
      }
    }

    if (reajustes.length > 0) {
      const totalReajuste = reajustes.reduce((s, r) => s + r.delta, 0);
      const maior = reajustes[0];
      narrative.push(
        `${reajustes.length} colaborador(es) tiveram o salário base alterado, somando ${formatCurrency(totalReajuste)} a mais por mês. Maior variação: ${maior.employeeName}, de ${formatCurrency(maior.salarioAnterior)} pra ${formatCurrency(maior.salarioAtual)}.`
      );
    }

    if (horasExtrasByCostCenter.length > 0) {
      const maior = horasExtrasByCostCenter[0];
      const totalHE = horasExtrasByCostCenter.reduce((s, h) => s + h.delta, 0);
      narrative.push(
        `Hora extra ${totalHE >= 0 ? "subiu" : "caiu"} ${formatCurrency(Math.abs(totalHE))} no total. Maior variação no centro de custo ${maior.label}: de ${formatCurrency(maior.anterior)} pra ${formatCurrency(maior.atual)}.`
      );
    }

    if (outrosProventos.length > 0) {
      const maior = outrosProventos[0];
      narrative.push(
        `"${maior.label}" foi o provento (fora salário e hora extra) que mais mudou: de ${formatCurrency(maior.anterior)} pra ${formatCurrency(maior.atual)}.`
      );
    }

    if (beneficiosExtra.length > 0) {
      const maior = beneficiosExtra[0];
      const totalBenef = beneficiosExtra.reduce((s, b) => s + b.delta, 0);
      narrative.push(
        `Benefícios extra-folha ${totalBenef >= 0 ? "subiram" : "caíram"} ${formatCurrency(Math.abs(totalBenef))}, principalmente em "${maior.label}".`
      );
    }
  }

  return {
    currentCompetence,
    previousCompetence,
    hasPreviousData,
    totalCurrent,
    totalPrevious,
    delta,
    deltaPercent,
    narrative,
    admissoes,
    saidas,
    reajustes,
    horasExtrasByCostCenter,
    outrosProventos,
    beneficiosExtra,
    headcountBySector,
  };
}
