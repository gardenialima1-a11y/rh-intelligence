"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Target, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { upsertGoal, deleteGoal, type GoalInput } from "@/actions/goals";

interface Goal {
  id: string;
  moduleKey: string;
  indicator: string;
  targetValue: number;
  comparator: "LTE" | "GTE" | "EQ";
  periodYear: number;
  periodMonth: number | null;
}

const COMPARATOR_LABEL: Record<string, string> = {
  LTE: "no máximo (≤)",
  GTE: "no mínimo (≥)",
  EQ: "exatamente (=)",
};

const emptyForm: GoalInput = {
  moduleKey: "",
  indicator: "",
  targetValue: 0,
  comparator: "LTE",
  periodYear: new Date().getFullYear(),
  periodMonth: null,
};

export function GoalsPanel({ goals }: { goals: Goal[] }) {
  const router = useRouter();
  const [formOpen, setFormOpen] = React.useState(false);
  const [form, setForm] = React.useState<GoalInput>(emptyForm);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  function openNew() {
    setForm(emptyForm);
    setError(null);
    setFormOpen(true);
  }

  function openEdit(g: Goal) {
    setForm({
      id: g.id,
      moduleKey: g.moduleKey,
      indicator: g.indicator,
      targetValue: g.targetValue,
      comparator: g.comparator,
      periodYear: g.periodYear,
      periodMonth: g.periodMonth,
    });
    setError(null);
    setFormOpen(true);
  }

  async function handleSave() {
    if (!form.moduleKey.trim() || !form.indicator.trim()) {
      setError("Preencha o módulo e o indicador.");
      return;
    }
    setSaving(true);
    const res = await upsertGoal(form);
    setSaving(false);
    if (!res.success) {
      setError(res.error ?? "Erro ao salvar.");
      return;
    }
    setFormOpen(false);
    router.refresh();
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    await deleteGoal(id);
    setDeletingId(null);
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div className="flex flex-col gap-1">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-4 w-4" /> Metas por indicador
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            São essas metas que alimentam o painel de alertas na home — se um indicador não tiver meta aqui, ele
            simplesmente não gera alerta.
          </p>
        </div>
        <Button variant="gold" size="sm" onClick={openNew}>
          <Plus className="h-3.5 w-3.5" /> Nova meta
        </Button>
      </CardHeader>
      <CardContent>
        {goals.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma meta cadastrada ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Módulo</TableHead>
                <TableHead>Indicador</TableHead>
                <TableHead>Meta</TableHead>
                <TableHead>Comparador</TableHead>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {goals.map((g) => (
                <TableRow key={g.id}>
                  <TableCell>{g.moduleKey}</TableCell>
                  <TableCell>{g.indicator}</TableCell>
                  <TableCell>{g.targetValue}</TableCell>
                  <TableCell>{COMPARATOR_LABEL[g.comparator]}</TableCell>
                  <TableCell>{g.periodMonth ? `${g.periodMonth}/${g.periodYear}` : g.periodYear}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => openEdit(g)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="outline" size="sm" disabled={deletingId === g.id} onClick={() => handleDelete(g.id)}>
                        {deletingId === g.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar meta" : "Nova meta"}</DialogTitle>
            <DialogDescription>
              O "módulo" e o "indicador" precisam bater com o que o sistema calcula (ex.: módulo{" "}
              <code>turnover</code>, indicador <code>turnover_geral</code>). Se não souber o nome certo, me
              pergunte antes de cadastrar.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label>Módulo</Label>
              <Input value={form.moduleKey} onChange={(e) => setForm({ ...form, moduleKey: e.target.value })} placeholder="turnover" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Indicador</Label>
              <Input value={form.indicator} onChange={(e) => setForm({ ...form, indicator: e.target.value })} placeholder="turnover_geral" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Valor da meta</Label>
              <Input
                type="number"
                step="any"
                value={form.targetValue}
                onChange={(e) => setForm({ ...form, targetValue: Number(e.target.value) })}
              />
              <p className="text-[11px] text-muted-foreground">Percentuais em decimal (ex.: 2,5% = 0,025).</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Comparador</Label>
              <select
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
                value={form.comparator}
                onChange={(e) => setForm({ ...form, comparator: e.target.value as GoalInput["comparator"] })}
              >
                <option value="LTE">No máximo (≤)</option>
                <option value="GTE">No mínimo (≥)</option>
                <option value="EQ">Exatamente (=)</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Ano</Label>
              <Input
                type="number"
                value={form.periodYear}
                onChange={(e) => setForm({ ...form, periodYear: Number(e.target.value) })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Mês (opcional)</Label>
              <Input
                type="number"
                min={1}
                max={12}
                value={form.periodMonth ?? ""}
                onChange={(e) => setForm({ ...form, periodMonth: e.target.value ? Number(e.target.value) : null })}
                placeholder="deixe vazio = ano todo"
              />
            </div>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button variant="gold" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
