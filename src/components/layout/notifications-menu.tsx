import Link from "next/link";
import { Bell } from "lucide-react";
import { prisma } from "@/lib/prisma";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

function severityVariant(severity: string) {
  if (severity === "CRITICO") return "danger" as const;
  if (severity === "ATENCAO") return "warning" as const;
  return "success" as const;
}

export async function NotificationsMenu() {
  const alerts = await prisma.alert.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "desc" },
    take: 8,
  });

  const criticalCount = alerts.filter((a) => a.severity === "CRITICO").length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={criticalCount > 0 ? `Notificações (${criticalCount} alertas críticos)` : "Notificações"}
          className="relative flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted"
        >
          <Bell className="h-4 w-4" />
          {criticalCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">
              {criticalCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Alertas ativos</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {alerts.length === 0 && (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">
            Nenhum alerta ativo no momento.
          </p>
        )}
        {alerts.map((a) => (
          <DropdownMenuItem key={a.id} asChild>
            <Link href={`/modulos/${a.moduleKey}`} className="flex flex-col items-start gap-1 whitespace-normal">
              <div className="flex w-full items-center justify-between gap-2">
                <span className="text-sm font-medium">{a.title}</span>
                <Badge variant={severityVariant(a.severity)}>{a.severity}</Badge>
              </div>
              <span className="text-xs text-muted-foreground">{a.description}</span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
