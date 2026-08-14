import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, CheckCircle2 } from "lucide-react";

type VagaSala = {
  id: string;
  title: string;
  unit: string | null;
  isCritical: boolean;
  daysOpen: number;
  targetDays: number;
  urgency: "CRITICA" | "ATENCAO" | "OK";
};

export function SalaDeVagas({ vagas }: { vagas: VagaSala[] }) {
  const ordenadas = [...vagas].sort((a, b) => b.daysOpen - a.daysOpen);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sala de vagas</CardTitle>
        <p className="text-xs text-muted-foreground">
          Status das {vagas.length} vaga(s) em aberto, ordenadas por urgência.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {ordenadas.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma vaga em aberto no momento.
          </p>
        ) : (
          ordenadas.map((v) => (
            <div
              key={v.id}
              className={`flex items-center gap-3 rounded-md px-3 py-2 ${
                v.urgency === "CRITICA"
                  ? "bg-red-50 dark:bg-red-950/30"
                  : v.urgency === "ATENCAO"
                    ? "bg-amber-50 dark:bg-amber-950/30"
                    : "bg-muted"
              }`}
            >
              {v.urgency === "CRITICA" ? (
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" />
              ) : v.urgency === "ATENCAO" ? (
                <Clock className="h-4 w-4 shrink-0 text-amber-600" />
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium">{v.title}</p>
                {v.unit && <p className="text-xs text-muted-foreground">{v.unit}</p>}
              </div>
              {v.isCritical && <Badge variant="danger">Crítica</Badge>}
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                {v.daysOpen} dia(s) em aberto (meta: {v.targetDays})
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
