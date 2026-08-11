import Link from "next/link";
import { ArrowLeft, Wallet, ShieldAlert, HeartPulse, ArrowDownRight } from "lucide-react";
import { resolveScopedFilters } from "@/lib/scope";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectorFilterInline } from "@/components/dashboard/sector-filter-inline";
import { PayrollDetailFilters } from "@/components/dashboard/payroll-detail-filters";
import { formatCurrency } from "@/lib/utils";
import { getAvailableDetailCompetences, getPayrollDetailReport } from "@/services/custos-detalhado";
import { prisma } from "@/lib/prisma";

export default async function CustosDetalhamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ unidade?: string; setorPrincipal?: string; setorSecundario?: string; mes?: string; colaborador?: string }>;
}) {
  const params = await searchParams;
  const filters = await resolveScopedFilters(params);

  const [competences, sectors, employeeOptions] = await Promise.all([
    getAvailableDetailCompetences(),
    prisma.costCenter.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.employee.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const { competenceKey, rows } = await getPayrollDetailReport({
    competenceKey: params.mes,
    costCenterId: filters.costCenterId,
    secondaryCostCenterId: filters.secondaryCostCenterId,
    employeeId: params.colaborador,
  });

  const totalPericulosidade = rows.reduce((s, r) => s + (r.periculosidadeValue ?? 0), 0);
  const totalInsalubridade = rows.reduce((s, r) => s + (r.insalubridadeValue ?? 0), 0);
  const totalFgts = rows.reduce((s, r) => s + (r.fgtsValue ?? 0), 0);
  const totalDescontos = rows.reduce((s, r) => s + r.totalDescontos, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Link href="/modulos/custos" className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para Custos
        </Link>
        <ModuleHeader
          title="Detalhamento da folha"
          description="Custo colaborador por colaborador: salário, periculosidade, insalubridade, encargos e descontos, com filtro por centro de custo."
        />
      </div>

      {competences.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhum mês com detalhamento importado ainda. Use &quot;Importar PDF da folha&quot; no módulo de Custos —
            esse detalhamento é gerado automaticamente a partir do PDF.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="flex-col items-start gap-3 space-y-0 md:flex-row md:items-center md:justify-between">
              <CardTitle>Filtros</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <PayrollDetailFilters competences={competences} employees={employeeOptions} />
                <SectorFilterInline sectors={sectors} />
              </div>
            </CardHeader>
          </Card>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <KpiCard label="Periculosidade (mês)" value={formatCurrency(totalPericulosidade)} icon={ShieldAlert} accent="danger" tooltip={"Soma de todas as linhas de \"Adicional de Periculosidade\" pagas no mês, entre os colaboradores filtrados."} />
            <KpiCard label="Insalubridade (mês)" value={formatCurrency(totalInsalubridade)} icon={HeartPulse} accent="danger" tooltip={"Soma de todas as linhas de \"Adicional de Insalubridade\" pagas no mês, entre os colaboradores filtrados."} />
            <KpiCard label="FGTS real (mês)" value={formatCurrency(totalFgts)} icon={Wallet} accent="gold" tooltip={"Soma do FGTS lido diretamente do PDF da folha (não é estimativa) para os colaboradores filtrados."} />
            <KpiCard label="Descontos totais (mês)" value={formatCurrency(totalDescontos)} icon={ArrowDownRight} accent="navy" tooltip={"Soma de todos os descontos da folha (INSS, vale-transporte, planos, empréstimos consignados, etc.) para os colaboradores filtrados."} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{rows.length} colaborador(es) em {competenceKey ?? "—"}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {rows.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Nenhum colaborador encontrado para esse filtro.</p>
              ) : (
                rows.map((r) => (
                  <details key={r.employeeId} className="group rounded-lg border border-border">
                    <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 p-3 text-sm">
                      <div className="flex flex-col">
                        <span className="font-medium text-navy dark:text-cream">{r.employeeName}</span>
                        <span className="text-xs text-muted-foreground">
                          Mat. {r.registration} · {r.costCenterName ?? "Sem centro de custo principal"}
                          {r.secondaryCostCenterName ? ` · ${r.secondaryCostCenterName}` : ""}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-xs">
                        <span>
                          <span className="text-muted-foreground">Base: </span>
                          <span className="font-medium">{formatCurrency(r.baseSalary)}</span>
                        </span>
                        <span className={r.periculosidadeValue ? "text-danger" : "text-muted-foreground"}>
                          Periculosidade: {r.periculosidadeValue ? formatCurrency(r.periculosidadeValue) : "não"}
                        </span>
                        <span className={r.insalubridadeValue ? "text-danger" : "text-muted-foreground"}>
                          Insalubridade: {r.insalubridadeValue ? formatCurrency(r.insalubridadeValue) : "não"}
                        </span>
                        <span>
                          <span className="text-muted-foreground">FGTS: </span>
                          <span className="font-medium">{r.fgtsValue != null ? formatCurrency(r.fgtsValue) : "—"}</span>
                        </span>
                        <span>
                          <span className="text-muted-foreground">Descontos: </span>
                          <span className="font-medium">{formatCurrency(r.totalDescontos)}</span>
                        </span>
                      </div>
                    </summary>

                    <div className="grid grid-cols-1 gap-4 border-t border-border p-3 md:grid-cols-2">
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted-foreground">Proventos ({formatCurrency(r.totalProventos)})</p>
                        <div className="flex flex-col gap-1">
                          {r.proventos.map((p, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{p.descricao}</span>
                              <span>{formatCurrency(p.valor)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="mb-1 text-xs font-medium text-muted-foreground">Descontos ({formatCurrency(r.totalDescontos)})</p>
                        <div className="flex flex-col gap-1">
                          {r.descontos.map((d, i) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{d.descricao}</span>
                              <span>{formatCurrency(d.valor)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </details>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
