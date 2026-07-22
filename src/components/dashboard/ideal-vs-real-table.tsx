"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Search, Loader2, Check } from "lucide-react";
import { updateTargetHeadcount } from "@/actions/target-headcount";

const ALL = "__all__";

interface IdealVsRealRow {
  id: string;
  name: string;
  area: string;
  ideal: number | null;
  realPrimary: number;
  diffPrimary: number | null;
  realSecondary: number;
  diffSecondary: number | null;
}

function DiffBadge({ diff }: { diff: number | null }) {
  if (diff === null) return <span className="text-muted-foreground">—</span>;
  if (diff === 0) return <Badge variant="success">Completo</Badge>;
  if (diff > 0) return <Badge variant="gold">+{diff}</Badge>;
  return <Badge variant="danger">{diff} (faltam {Math.abs(diff)})</Badge>;
}

function EditableIdeal({ costCenterId, initialValue }: { costCenterId: string; initialValue: number | null }) {
  const [value, setValue] = React.useState(initialValue !== null ? String(initialValue) : "");
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const router = useRouter();

  async function handleBlur() {
    const parsed = value.trim() === "" ? null : Number(value);
    if (parsed === initialValue) return;
    setSaving(true);
    setSaved(false);
    const result = await updateTargetHeadcount(costCenterId, parsed);
    setSaving(false);
    if (result.success) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 1500);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlur}
        className="h-8 w-20"
        placeholder="—"
      />
      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      {saved && <Check className="h-3.5 w-3.5 text-success" />}
    </div>
  );
}

export function IdealVsRealTable({ rows }: { rows: IdealVsRealRow[] }) {
  const [search, setSearch] = React.useState("");
  const [areaFilter, setAreaFilter] = React.useState(ALL);

  const areas = Array.from(new Set(rows.map((r) => r.area))).sort();

  const filtered = rows.filter((r) => {
    if (search.trim() && !r.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (areaFilter !== ALL && r.area !== areaFilter) return false;
    return true;
  });

  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nenhum quadro ideal cadastrado ainda.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar setor..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={areaFilter} onValueChange={setAreaFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Setor principal" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os setores principais</SelectItem>
            {areas.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{filtered.length} de {rows.length}</span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Área</TableHead>
            <TableHead>Setor</TableHead>
            <TableHead>Quadro ideal</TableHead>
            <TableHead>Real (setor principal)</TableHead>
            <TableHead>Diferença (principal)</TableHead>
            <TableHead>Real (setor secundário)</TableHead>
            <TableHead>Diferença (secundário)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((r) => (
            <TableRow key={r.id}>
              <TableCell>
                <Badge variant="gold">{r.area}</Badge>
              </TableCell>
              <TableCell>{r.name}</TableCell>
              <TableCell>
                <EditableIdeal costCenterId={r.id} initialValue={r.ideal} />
              </TableCell>
              <TableCell className="font-semibold">{r.realPrimary}</TableCell>
              <TableCell>
                <DiffBadge diff={r.diffPrimary} />
              </TableCell>
              <TableCell className="font-semibold">{r.realSecondary}</TableCell>
              <TableCell>
                <DiffBadge diff={r.diffSecondary} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
