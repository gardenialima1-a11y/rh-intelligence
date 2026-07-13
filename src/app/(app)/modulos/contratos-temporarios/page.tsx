import { AlertTriangle, Clock3 } from "lucide-react";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { TableCardHeader } from "@/components/dashboard/table-card-header";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatNumber } from "@/lib/utils";
import { getFixedTermContracts } from "@/services/contratos-temporarios";

const CONTRACT_LABEL: Record<string, string> = { APRENDIZ: "Jovem Aprendiz", ESTAGIO: "Estágio", TEMPORARIO: "Temporário" };

export default async function ContratosTemporariosPage() {
  const contracts = await getFixedTermContracts();

  const vencidos = contracts.filter((c) => c.expiry.status === "vencido").length;
  const venceEm30 = contracts.filter((c) => c.expiry.status === "vence_em_30_dias").length;
  const semData = contracts.filter((c) => c.expiry.status === "sem_data").length;

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader
        title="Contratos por Prazo Determinado"
        description="Jovem Aprendiz, Estágio e Temporário — acompanhamento do vencimento de contrato."
        moduleKey="contratos-temporarios"
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Total de contratos" value={formatNumber(contracts.length)} icon={Clock3} accent="navy" />
        <KpiCard label="Vencem em até 30 dias" value={formatNumber(venceEm30)} icon={AlertTriangle} accent="gold" />
        <KpiCard label="Já vencidos" value={formatNumber(vencidos)} icon={AlertTriangle} accent="danger" />
        <KpiCard label="Sem data cadastrada" value={formatNumber(semData)} icon={Clock3} accent="gold" />
      </div>

      <Card>
        <TableCardHeader
          title="Contratos"
          filename="contratos-prazo-determinado"
          data={contracts.map((c) => ({
            nome: c.name,
            matricula: c.registration,
            tipo: CONTRACT_LABEL[c.contractType] ?? c.contractType,
            cargo: c.position ?? "",
            setor: c.costCenter ?? "",
            unidade: c.unit,
            admissao: c.admissionDate,
            termino: c.contractEndDate ?? "",
            dias_restantes: c.expiry.daysRemaining ?? "",
          }))}
          columns={[
            { key: "nome", label: "Nome" },
            { key: "matricula", label: "Matrícula" },
            { key: "tipo", label: "Tipo" },
            { key: "cargo", label: "Cargo" },
            { key: "setor", label: "Setor" },
            { key: "unidade", label: "Unidade" },
            { key: "admissao", label: "Admissão" },
            { key: "termino", label: "Término" },
            { key: "dias_restantes", label: "Dias restantes" },
          ]}
        />
        <CardContent>
          {contracts.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum colaborador Jovem Aprendiz, Estágio ou Temporário ativo no momento.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Admissão</TableHead>
                  <TableHead>Término do contrato</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{CONTRACT_LABEL[c.contractType] ?? c.contractType}</Badge>
                    </TableCell>
                    <TableCell>{c.position ?? "—"}</TableCell>
                    <TableCell>{c.costCenter ?? "—"}</TableCell>
                    <TableCell>{formatDate(c.admissionDate)}</TableCell>
                    <TableCell>{c.contractEndDate ? formatDate(c.contractEndDate) : "—"}</TableCell>
                    <TableCell>
                      {c.expiry.status === "vencido" && <Badge variant="danger">Vencido ({Math.abs(c.expiry.daysRemaining ?? 0)}d atrás)</Badge>}
                      {c.expiry.status === "vence_em_30_dias" && <Badge variant="warning">Vence em {c.expiry.daysRemaining}d</Badge>}
                      {c.expiry.status === "no_prazo" && <Badge variant="success">No prazo</Badge>}
                      {c.expiry.status === "sem_data" && <Badge variant="outline">Sem data</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
