import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function NarrativeCard({ text }: { text: string }) {
  return (
    <Card className="border-gold/25 bg-gradient-to-br from-gold/[0.07] to-transparent shadow-[var(--shadow-xs)]">
      <CardContent className="flex items-start gap-3.5 p-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gold/15 text-gold-text ring-1 ring-inset ring-gold/20">
          <Sparkles className="h-[18px] w-[18px]" strokeWidth={2.25} />
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gold-text">Insight automático</p>
          <p className="text-[13.5px] leading-relaxed text-foreground/90">{text}</p>
        </div>
      </CardContent>
    </Card>
  );
}
