"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { DollarSign, Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { upsertRevenueEntry, deleteRevenueEntry } from "@/actions/revenue";

interface RevenueEntry {
  id: string;
  competence: string | Date;
  amount: number;
}

export function RevenuePanel({ entries }: { entries: RevenueEntry[] }) {
  const router = useRouter();
  const [competence, setCompetence] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  async function handleSave() {
    if (!competence || !amount) {
      setError("Preencha o mês e o valor.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await upsertRevenueEntry(competence, Number(amount));
    setSaving(false);
    if (!res.success) {
      setError(res.error ?? "Erro ao salvar.");
      return;
    }
    setCompetence("");
    setAmount("");
    router.refresh();
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await deleteRevenueEntry(id);
    setDeletingId(null);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-4 w-4" /> Receita mensal real
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Usada no cálculo de "Custo de pessoal % da receita" e HCROI na home. Sem um valor real cadastrado aqui
          para o mês, o sistema não tem como calcular esses indicadores corretamente.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1.5">
            <Label>Mês (AAAA-MM)</Label>
            <Input placeholder="2026-06" value={competence} onChange={(e) => setCompetence(e.target.value)} className="w-32" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Receita de vendas (R$)</Label>
            <Input type="number" placeholder="5400000" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-40" />
          </div>
          <Button variant="gold" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Salvar
          </Button>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Competência</TableHead>
              <TableHead>Receita</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{formatDate(e.competence)}</TableCell>
                <TableCell>{formatCurrency(e.amount)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" disabled={deletingId === e.id} onClick={() => handleDelete(e.id)}>
                    {deletingId === e.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
