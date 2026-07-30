import { AlertTriangle, TrendingUp, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AttentionPoint } from "@/lib/analytics/catraca-insight";

const SEVERITY_ICON: Record<AttentionPoint["severity"], typeof AlertTriangle> = {
  danger: AlertTriangle,
  warning: TrendingUp,
  info: Info,
};

const SEVERITY_COLOR: Record<AttentionPoint["severity"], string> = {
  danger: "text-danger",
  warning: "text-warning-text",
  info: "text-muted-foreground",
};

export function AttentionPointsCard({ points, title = "Pontos de atenção" }: { points: AttentionPoint[]; title?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-3">
          {points.map((p, i) => {
            const Icon = SEVERITY_ICON[p.severity];
            return (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${SEVERITY_COLOR[p.severity]}`} />
                <span className="text-foreground/90">{p.text}</span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
