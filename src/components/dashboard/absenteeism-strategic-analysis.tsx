"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import type { AbsenteeismoMonthBreakdown } from "@/services/absenteismo";

export function AbsenteeismStrategicAnalysis({ data }: { data: AbsenteeismoMonthBreakdown[] }) {
  const highMonths = data.filter((m) => m.isAlta);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Sparkles className="h-3.5 w-3.5" />
          Análise estratégica
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Análise estratégica do absenteísmo</DialogTitle>
        </DialogHeader>

        {highMonths.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum mês do período se destacou acima da média — o comportamento está estável, sem pontos que exijam
            atenção específica no momento.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-xs text-muted-foreground">
              Meses com taxa de absenteísmo pelo menos 20% acima da média do período selecionado. É um recorte para
              acompanhamento e priorização — não indica, por si só, um problema grave.
            </p>
            <div className="flex flex-col gap-3">
              {highMonths.map((m) => (
                <div key={m.key} className="rounded-xl border border-border p-3">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-navy dark:text-cream">{m.label}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="warning">{(m.rate * 100).toFixed(1)}%</Badge>
                      <span className="text-xs text-muted-foreground">{formatNumber(m.hoursLost)}h perdidas</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{m.insight}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
