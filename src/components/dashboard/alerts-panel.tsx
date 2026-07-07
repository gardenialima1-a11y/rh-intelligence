import Link from "next/link";
import { AlertTriangle, AlertOctagon, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Alert } from "@prisma/client";

function iconFor(severity: string) {
  if (severity === "CRITICO") return AlertOctagon;
  if (severity === "ATENCAO") return AlertTriangle;
  return CheckCircle2;
}

function variantFor(severity: string) {
  if (severity === "CRITICO") return "danger" as const;
  if (severity === "ATENCAO") return "warning" as const;
  return "success" as const;
}

export function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Painel de alertas</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {alerts.length === 0 && (
          <p className="py-8 text-center text-[13px] text-muted-foreground">
            Nenhum indicador fora da meta no momento.
          </p>
        )}
        {alerts.map((a) => {
          const Icon = iconFor(a.severity);
          return (
            <Link
              key={a.id}
              href={`/modulos/${a.moduleKey}`}
              className="flex items-start gap-3 rounded-xl border border-border p-3.5 transition-colors hover:border-gold/30 hover:bg-gold/[0.05]"
            >
              <Icon
                className={`mt-0.5 h-4 w-4 shrink-0 ${
                  a.severity === "CRITICO" ? "text-danger" : a.severity === "ATENCAO" ? "text-warning-text" : "text-success"
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium">{a.title}</span>
                  <Badge variant={variantFor(a.severity)}>{a.severity}</Badge>
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{a.description}</p>
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
