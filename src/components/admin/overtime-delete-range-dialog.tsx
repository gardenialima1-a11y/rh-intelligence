"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, Search, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { formatNumber, formatCurrency } from "@/lib/utils";
import { previewOvertimeRange, deleteOvertimeRange, type OvertimeRangePreview } from "@/actions/overtime-manual";

interface OptionItem {
  id: string;
  name: string;
}

export function OvertimeDeleteRangeDialog({ employees }: { employees: OptionItem[] }) {
  const [open, setOpen] = React.useState(false);
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [employeeId, setEmployeeId] = React.useState<string>("all");
  const [preview, setPreview] = React.useState<OvertimeRangePreview | null>(null);
  const [checking, setChecking] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [deletedCount, setDeletedCount] = React.useState<number | null>(null);
  const router = useRouter();

  function reset() {
    setStartDate("");
    setEndDate("");
    setEmployeeId("all");
    setPreview(null);
    setError(null);
    setDeletedCount(null);
  }

  async function handleCheck() {
    setError(null);
    setDeletedCount(null);
    setPreview(null);
    if (!startDate || !endDate) {
      setError("Informe a data inicial e a data final.");
      return;
    }
    setChecking(true);
    const result = await previewOvertimeRange({
      startDate,
      endDate,
      employeeId: employeeId === "all" ? null : employeeId,
    });
    setChecking(false);
    if (!result.success) {
      setError(result.error ?? "Não foi possível consultar o período.");
      return;
    }
    setPreview(result.preview ?? null);
  }

  async function handleDelete() {
    if (!preview) return;
    if (preview.count === 0) return;
    if (
      !confirm(
        `Excluir ${preview.count} lançamento(s) de hora extra entre ${startDate} e ${endDate}? Essa ação não pode ser desfeita.`
      )
    ) {
      return;
    }
    setDeleting(true);
    const result = await deleteOvertimeRange({
      startDate,
      endDate,
      employeeId: employeeId === "all" ? null : employeeId,
    });
    setDeleting(false);
    if (!result.success) {
      setError(result.error ?? "Não foi possível excluir os lançamentos.");
      return;
    }
    setDeletedCount(result.deletedCount ?? 0);
    setPreview(null);
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Trash2 className="h-4 w-4" /> Excluir por período
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Excluir lançamentos de horas extras por período</DialogTitle>
          <DialogDescription>
            Escolha o intervalo de datas (e, se quiser, um colaborador específico), confira quantos lançamentos serão
            afetados e só então confirme a exclusão.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="startDate">Data inicial</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPreview(null);
                setDeletedCount(null);
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="endDate">Data final</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPreview(null);
                setDeletedCount(null);
              }}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label>Colaborador (opcional)</Label>
            <Select
              value={employeeId}
              onValueChange={(v) => {
                setEmployeeId(v);
                setPreview(null);
                setDeletedCount(null);
              }}
            >
              <SelectTrigger><SelectValue placeholder="Todos os colaboradores" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os colaboradores</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && (
          <p className="flex items-center gap-2 text-sm text-danger">
            <AlertTriangle className="h-4 w-4" /> {error}
          </p>
        )}

        {preview && (
          <div className="rounded-lg border border-border p-3 text-sm">
            {preview.count === 0 ? (
              <p className="text-muted-foreground">Nenhum lançamento encontrado nesse período.</p>
            ) : (
              <p>
                <strong>{preview.count}</strong> lançamento(s) encontrados · {formatNumber(preview.totalHours)} h ·{" "}
                {formatCurrency(preview.totalCost)}
              </p>
            )}
          </div>
        )}

        {deletedCount !== null && (
          <p className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" /> {deletedCount} lançamento(s) excluído(s) com sucesso.
          </p>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Fechar</Button>
          </DialogClose>
          <Button type="button" variant="outline" onClick={handleCheck} disabled={checking}>
            {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Consultar
          </Button>
          {preview && preview.count > 0 && (
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              Excluir {preview.count} lançamento(s)
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
