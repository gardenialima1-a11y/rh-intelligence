import { ModuleHeader } from "@/components/dashboard/module-header";
import { Card, CardContent } from "@/components/ui/card";
import { TableCardHeader } from "@/components/dashboard/table-card-header";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getBirthdaysThisMonth, getWorkAnniversariesThisMonth, type AniversarianteRow } from "@/services/aniversariantes";

const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function AniversarianteTable({ rows, suffix }: { rows: AniversarianteRow[]; suffix: string }) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Ninguém neste mês.</p>;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Dia</TableHead>
          <TableHead>Nome</TableHead>
          <TableHead>Cargo</TableHead>
          <TableHead>Setor</TableHead>
          <TableHead>Unidade</TableHead>
          <TableHead>{suffix}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell>
              <Badge variant="outline">{String(r.day).padStart(2, "0")}</Badge>
            </TableCell>
            <TableCell>{r.name}</TableCell>
            <TableCell>{r.position ?? "—"}</TableCell>
            <TableCell>{r.costCenter ?? "—"}</TableCell>
            <TableCell>{r.unit}</TableCell>
            <TableCell>{r.years} {suffix.toLowerCase()}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default async function AniversariantesPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const month = params.mes ? Math.min(11, Math.max(0, Number(params.mes) - 1)) : now.getMonth();

  const [birthdays, anniversaries] = await Promise.all([
    getBirthdaysThisMonth(month),
    getWorkAnniversariesThisMonth(month),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader
        title="Aniversariantes"
        description="Aniversário de vida e de empresa dos colaboradores ativos, mês a mês."
        moduleKey="aniversariantes"
      />

      <div className="flex flex-wrap gap-2">
        {MONTH_LABELS.map((label, i) => (
          
            key={label}
            href={`?mes=${i + 1}`}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              i === month ? "bg-navy text-cream dark:bg-gold dark:text-navy-dark" : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            {label}
          </a>
        ))}
      </div>

      <Card>
        <TableCardHeader
          title={`🎂 Aniversário de vida — ${MONTH_LABELS[month]}`}
          filename={`aniversarios-vida-${MONTH_LABELS[month].toLowerCase()}`}
          data={birthdays.map((r) => ({
            dia: r.day,
            nome: r.name,
            matricula: r.registration,
            cargo: r.position ?? "",
            setor: r.costCenter ?? "",
            unidade: r.unit,
            idade: r.years,
          }))}
          columns={[
            { key: "dia", label: "Dia" },
            { key: "nome", label: "Nome" },
            { key: "matricula", label: "Matrícula" },
            { key: "cargo", label: "Cargo" },
            { key: "setor", label: "Setor" },
            { key: "unidade", label: "Unidade" },
            { key: "idade", label: "Idade" },
          ]}
        />
        <CardContent>
          <AniversarianteTable rows={birthdays} suffix="Anos" />
        </CardContent>
      </Card>

      <Card>
        <TableCardHeader
          title={`🎉 Aniversário de empresa — ${MONTH_LABELS[month]}`}
          filename={`aniversarios-empresa-${MONTH_LABELS[month].toLowerCase()}`}
          data={anniversaries.map((r) => ({
            dia: r.day,
            nome: r.name,
            matricula: r.registration,
            cargo: r.position ?? "",
            setor: r.costCenter ?? "",
            unidade: r.unit,
            anos_de_casa: r.years,
          }))}
          columns={[
            { key: "dia", label: "Dia" },
            { key: "nome", label: "Nome" },
            { key: "matricula", label: "Matrícula" },
            { key: "cargo", label: "Cargo" },
            { key: "setor", label: "Setor" },
            { key: "unidade", label: "Unidade" },
            { key: "anos_de_casa", label: "Anos de casa" },
          ]}
        />
        <CardContent>
          <AniversarianteTable rows={anniversaries} suffix="Anos de casa" />
        </CardContent>
      </Card>
    </div>
  );
}
