import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Sparkline } from "@/components/dashboard/sparkline";

export interface KpiCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  deltaLabel?: string;
  deltaDirection?: "up" | "down" | "flat";
  deltaSentiment?: "positive" | "negative" | "neutral";
  sparklineData?: number[];
  accent?: "navy" | "gold" | "success" | "danger";
}

const ACCENT_MAP = {
  navy: "text-navy bg-navy/10 dark:text-cream dark:bg-cream/10",
  gold: "text-gold-text bg-gold/12",
  success: "text-success bg-success/12",
  danger: "text-danger bg-danger/12",
};

const ACCENT_BORDER_MAP = {
  navy: "before:bg-navy dark:before:bg-cream/70",
  gold: "before:bg-gold",
  success: "before:bg-success",
  danger: "before:bg-danger",
};

const DELTA_PILL_MAP = {
  positive: "bg-success/12 text-success",
  negative: "bg-danger/12 text-danger",
  neutral: "bg-muted text-muted-foreground",
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  deltaLabel,
  deltaDirection = "flat",
  deltaSentiment = "neutral",
  sparklineData,
  accent = "navy",
}: KpiCardProps) {
  const DeltaIcon = deltaDirection === "up" ? ArrowUpRight : deltaDirection === "down" ? ArrowDownRight : Minus;

  return (
    <Card
      className={cn(
        "card-interactive relative overflow-hidden pl-0.5",
        "before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:content-['']",
        ACCENT_BORDER_MAP[accent]
      )}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </span>
            <span className="numeric text-[26px] font-bold leading-none text-navy dark:text-cream">{value}</span>
            {deltaLabel && (
              <span
                className={cn(
                  "mt-0.5 flex w-fit items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
                  DELTA_PILL_MAP[deltaSentiment]
                )}
              >
                <DeltaIcon className="h-3 w-3" />
                {deltaLabel}
              </span>
            )}
          </div>
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ring-black/5",
              ACCENT_MAP[accent]
            )}
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
          </div>
        </div>
        {sparklineData && sparklineData.length > 1 && (
          <div className="mt-3 h-8">
            <Sparkline data={sparklineData} accent={accent} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
