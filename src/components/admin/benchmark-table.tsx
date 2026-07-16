"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { EditBenchmarkDialog } from "@/components/admin/edit-benchmark-dialog";
import { DeleteBenchmarkButton } from "@/components/admin/delete-benchmark-button";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { BenchmarkRow } from "@/services/salary-benchmark";

export function BenchmarkTable({ rows }: { rows: BenchmarkRow[] }) {
  const [search, setSearch] = React.useState("");

  const filtered = rows.filter((r) => {
    if (!search.trim()) return true;
    return r.positionName.toLowerCase().includes(search.trim().toLowerCase());
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar cargo..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <span className="text-xs text-muted-foreground">{filtered.length} de {rows.length} cargo(s)</span>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">Nenhum cargo encontrado para essa busca.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cargo</TableHead>
              <TableHead>Salário médio (empresa)</TableHead>
              <TableHead>Mercado (mín–méd–máx)</TableHead>
              <TableHead>Gap</TableHead>
              <TableHead>Fonte / Data</TableHead>
              <TableHead>Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.positionId}>
                <TableCell>{r.positionName}</TableCell>
                <TableCell>{r.companyAvgSalary ? formatCurrency(r.companyAvgSalary) : "—"}</TableCell>
                <TableCell>
                  {r.marketAvgSalary
                    ? `${formatCurrency(r.marketMinSalary ?? 0)} – ${formatCurrency(r.marketAvgSalary)} – ${formatCurrency(r.marketMaxSalary ?? 0)}`
                    : "não cadastrado"}
                </TableCell>
                <TableCell>
                  {r.gapPercent === null ? (
                    <Badge variant="outline">Sem comparação</Badge>
                  ) : Math.abs(r.gapPercent) <= 5 ? (
                    <Badge variant="gold">
                      <Minus className="h-3 w-3" />
                      Na média
                    </Badge>
                  ) : r.gapPercent > 5 ? (
                    <Badge variant="success">
                      <ArrowUpRight className="h-3 w-3" />
                      {r.gapPercent.toFixed(1)}% acima
                    </Badge>
                  ) : (
                    <Badge variant="danger">
                      <ArrowDownRight className="h-3 w-3" />
                      {Math.abs(r.gapPercent).toFixed(1)}% abaixo
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="max-w-[220px] whitespace-normal text-xs text-muted-foreground">
                  {r.source ?? "—"}
                  {r.referenceDate ? ` · ${formatDate(r.referenceDate)}` : ""}
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <EditBenchmarkDialog
                      positionId={r.positionId}
                      positionName={r.positionName}
                      defaultValues={{
                        marketMinSalary: r.marketMinSalary ?? undefined,
                        marketAvgSalary: r.marketAvgSalary ?? undefined,
                        marketMaxSalary: r.marketMaxSalary ?? undefined,
                        source: r.source ?? undefined,
                        referenceDate: r.referenceDate ? r.referenceDate.toISOString().slice(0, 10) : undefined,
                      }}
                    />
                    {r.marketAvgSalary !== null && <DeleteBenchmarkButton positionId={r.positionId} />}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
