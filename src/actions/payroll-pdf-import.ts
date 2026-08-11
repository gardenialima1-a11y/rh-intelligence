"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parsePayrollBaseSalaries, type PayrollBaseSalaryProvento } from "@/lib/pdf/payroll-parser";
import { confirmPayrollPdfImportSchema } from "@/lib/validation/payroll-pdf-import";

const ALLOWED_ROLES = ["ADMINISTRADOR", "RH"];
const DEFAULT_BENEFITS_RATE = 0.18;
// FGTS geralmente vem real da folha (campo "Valor FGTS:"); o que falta estimar é só a
// parte patronal de INSS/terceiros. 34% + ~8% de FGTS ≈ os mesmos ~42% usados antes,
// mas agora com a fração de FGTS real em vez de estimada.
const ESTIMATED_PATRONAL_RATE = 0.34;
const FALLBACK_FGTS_RATE = 0.08;

async function requireHrAccess() {
  const session = await auth();
  if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
    throw new Error("Você não tem permissão para importar a folha de pagamento.");
  }
}

function normalizeName(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
}

export interface PayrollPdfPreviewRow {
  matricula: string;
  nome: string;
  cpf: string | null;
  baseSalary: number | null;
  proventos: PayrollBaseSalaryProvento[];
  descontos: PayrollBaseSalaryProvento[];
  /** FGTS real do mês, lido da folha (não é estimativa). Usado como parte do encargo ao confirmar. */
  fgtsValue: number | null;
  employeeId: string | null;
  matched: boolean;
  matchType: "registration" | "name" | null;
}

export interface PayrollPdfPreviewResult {
  success: boolean;
  error?: string;
  competencia?: string | null;
  dataFolha?: string | null;
  competenceInputValue?: string;
  rows?: PayrollPdfPreviewRow[];
  unmatchedCount?: number;
  noSalaryCount?: number;
}

/** "Julho/2026" -> "2026-07" (pro seletor de mês da prévia). */
function toCompetenceInputValue(competenciaExtenso: string | null): string {
  if (!competenciaExtenso) return "";
  const MESES: Record<string, string> = {
    janeiro: "01", fevereiro: "02", março: "03", marco: "03", abril: "04",
    maio: "05", junho: "06", julho: "07", agosto: "08", setembro: "09",
    outubro: "10", novembro: "11", dezembro: "12",
  };
  const m = competenciaExtenso.match(/^([A-Za-zçÇ]+)\/(\d{4})$/);
  if (!m) return "";
  const mes = MESES[m[1].toLowerCase()];
  return mes ? `${m[2]}-${mes}` : "";
}

/** Lê o PDF da folha (base64) e monta a prévia do salário base de cada colaborador — sem gravar nada ainda. */
export async function extractPayrollCostsPdf(base64Pdf: string): Promise<PayrollPdfPreviewResult> {
  try {
    await requireHrAccess();

    const buffer = Buffer.from(base64Pdf, "base64");
    const parsed = await parsePayrollBaseSalaries(new Uint8Array(buffer));

    if (parsed.rows.length === 0) {
      return {
        success: false,
        error: "Não encontrei colaboradores nesse PDF. Confira se é o relatório de folha certo.",
      };
    }

    const allEmployees = await prisma.employee.findMany({ select: { id: true, name: true, registration: true } });
    const byRegistration = new Map(allEmployees.map((e) => [e.registration.trim(), e.id]));
    const byNormalizedName = new Map<string, string[]>();
    for (const e of allEmployees) {
      const key = normalizeName(e.name);
      const list = byNormalizedName.get(key) ?? [];
      list.push(e.id);
      byNormalizedName.set(key, list);
    }

    let unmatchedCount = 0;
    let noSalaryCount = 0;

    const rows: PayrollPdfPreviewRow[] = parsed.rows.map((r) => {
      let employeeId: string | null = byRegistration.get(r.matricula.trim()) ?? null;
      let matchType: PayrollPdfPreviewRow["matchType"] = employeeId ? "registration" : null;

      if (!employeeId) {
        const candidates = byNormalizedName.get(normalizeName(r.nome));
        if (candidates && candidates.length === 1) {
          employeeId = candidates[0];
          matchType = "name";
        }
      }

      if (!employeeId) unmatchedCount += 1;
      if (r.baseSalary === null) noSalaryCount += 1;

      return {
        matricula: r.matricula,
        nome: r.nome,
        cpf: r.cpf,
        baseSalary: r.baseSalary,
        proventos: r.proventos,
        descontos: r.descontos,
        fgtsValue: r.fgtsValue,
        employeeId,
        matched: employeeId != null,
        matchType,
      };
    });

    return {
      success: true,
      competencia: parsed.competencia,
      dataFolha: parsed.dataFolha,
      competenceInputValue: toCompetenceInputValue(parsed.competencia),
      rows,
      unmatchedCount,
      noSalaryCount,
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao ler o PDF da folha." };
  }
}

export interface ConfirmPayrollPdfImportResult {
  success: boolean;
  error?: string;
  importedCount?: number;
}

/** Grava os lançamentos de custo confirmados na prévia, um por colaborador, no mês escolhido. */
export async function confirmPayrollPdfImport(raw: unknown): Promise<ConfirmPayrollPdfImportResult> {
  try {
    await requireHrAccess();
    const parsed = confirmPayrollPdfImportSchema.safeParse(raw);
    if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

    const [yStr, mStr] = parsed.data.competence.split("-");
    const competence = new Date(Number(yStr), Number(mStr) - 1, 1);

    let importedCount = 0;
    for (const row of parsed.data.rows) {
      const baseSalary = Number(row.baseSalary);
      if (Number.isNaN(baseSalary) || baseSalary <= 0) continue;

      const fgtsReal = row.fgtsValue != null && row.fgtsValue !== "" ? Number(row.fgtsValue) : null;
      const fgtsPart = fgtsReal != null && !Number.isNaN(fgtsReal) ? fgtsReal : baseSalary * FALLBACK_FGTS_RATE;

      const benefitsCost = Math.round(baseSalary * DEFAULT_BENEFITS_RATE * 100) / 100;
      const chargesCost = Math.round((fgtsPart + baseSalary * ESTIMATED_PATRONAL_RATE) * 100) / 100;
      const totalCost = baseSalary + benefitsCost + chargesCost;

      await prisma.payrollEntry.upsert({
        where: { employeeId_competence: { employeeId: row.employeeId, competence } },
        create: { employeeId: row.employeeId, competence, baseSalary, benefitsCost, chargesCost, totalCost, fgtsValue: fgtsReal },
        update: { baseSalary, benefitsCost, chargesCost, totalCost, fgtsValue: fgtsReal },
      });

      // Substitui o detalhamento linha a linha desse colaborador nesse mês
      // (reimportar o mesmo mês sempre deixa o detalhamento atualizado, sem duplicar).
      await prisma.payrollLineItem.deleteMany({ where: { employeeId: row.employeeId, competence } });
      const lineItems = [
        ...row.proventos
          .filter((p) => p.valor != null)
          .map((p) => ({ employeeId: row.employeeId, competence, tipo: "PROVENTO", verba: p.verba, descricao: p.descricao, valor: p.valor! })),
        ...row.descontos
          .filter((d) => d.valor != null)
          .map((d) => ({ employeeId: row.employeeId, competence, tipo: "DESCONTO", verba: d.verba, descricao: d.descricao, valor: d.valor! })),
      ];
      if (lineItems.length > 0) {
        await prisma.payrollLineItem.createMany({ data: lineItems });
      }

      importedCount += 1;
    }

    revalidatePath("/modulos/custos");
    revalidatePath("/modulos/custos/detalhamento");
    revalidatePath("/modulos/beneficios");
    revalidatePath("/modulos/jornada");
    revalidatePath("/modulos/administracao");
    revalidatePath("/");
    return { success: true, importedCount };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao importar os lançamentos." };
  }
}
