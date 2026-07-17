"use client";

import * as React from "react";
import { Search, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
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
import { getCatracaDayDetail, type CatracaDayDetail } from "@/actions/catraca-diagnostico";

const STATUS_LABEL: Record<string, { label: string; variant: "success" | "warning" | "outline" | "danger" }> = {
  contado: { label: "Contado", variant: "success" },
  almoco_ignorado: { label: "Almoço (ignorado)", variant: "outline" },
  abaixo_do_limite: { label: "Pausa curta (ignorado)", variant: "outline" },
  sem_par: { label: "Evento avulso, sem par", variant: "danger" },
};

function formatTime(iso: string | Date | null): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function CatracaDayDetailDialog() {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [date, setDate] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<CatracaDayDetail | null>(null);

  async function handleSearch() {
    if (!name.trim() || !date) {
      setError("Preencha o nome e a data.");
      return;
    }
    setError(null);
    setDetail(null);
    setLoading(true);
    const result = await getCatracaDayDetail(name.trim(), date);
    setLoading(false);
    if (!result.success) {
      setError(result.error ?? "Erro ao consultar.");
      return;
    }
    setDetail(result.detail ?? null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setDetail(null);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Search className="h-4 w-4" /> Investigar um dia específico
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Investigar catraca de um colaborador em um dia</DialogTitle>
          <DialogDescription>
            Mostra cada batida de ponto e explica exatamente por que cada intervalo foi contado, ignorado (almoço,
            pausa curta) ou ficou sem par — útil pra entender um número que pareça estranho.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nome do colaborador</Label>
            <Input id="name" placeholder="Ex.: Ruy Jamerson" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="date">Data</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>

        <Button type="button" variant="gold" onClick={handleSearch} disabled={loading} className="w-fit">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          Consultar
        </Button>

        {error && (
          <p className="flex items-center gap-2 text-sm text-danger">
            <AlertTriangle className="h-4 w-4" /> {error}
          </p>
        )}

        {detail && (
          <div className="flex flex-col gap-4">
            <p className="text-sm">
              <strong>{detail.employeeName}</strong> · total contado no dia: <strong>{detail.totalMinutes} min</strong>
            </p>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-navy dark:text-cream">Batidas registradas ({detail.events.length})</h4>
              <div className="flex flex-wrap gap-2">
                {detail.events.map((e, i) => (
                  <Badge key={i} variant={e.direction === "SAIDA" ? "success" : "gold"}>
                    {formatTime(e.timestamp)} · {e.direction === "SAIDA" ? "Saída (voltou)" : "Entrada (saiu)"}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold text-navy dark:text-cream">Como cada intervalo foi calculado</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Saiu (Entrada)</TableHead>
                    <TableHead>Voltou (Saída)</TableHead>
                    <TableHead>Duração bruta</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Minutos contados</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.pairs.map((p, i) => {
                    const status = STATUS_LABEL[p.status];
                    return (
                      <TableRow key={i}>
                        <TableCell>{formatTime(p.entrada)}</TableCell>
                        <TableCell>{formatTime(p.saida)}</TableCell>
                        <TableCell>{p.rawMinutes !== null ? `${p.rawMinutes} min` : "—"}</TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell>{p.countedMinutes} min</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">Fechar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
