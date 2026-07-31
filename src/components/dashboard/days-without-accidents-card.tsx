import { ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { DaysWithoutAccidentsInfo } from "@/services/sst";

export function DaysWithoutAccidentsCard({ info }: { info: DaysWithoutAccidentsInfo }) {
  const isRecord = info.totalAcidentesRegistrados > 0 && info.diasAtuais >= info.recordeDias;

  return (
    <Card className="border-2 border-navy bg-navy text-cream dark:border-gold">
      <CardContent className="flex flex-col items-center gap-1.5 py-8 text-center">
        <ShieldCheck className="h-8 w-8 text-gold" />
        <p className="text-5xl font-bold tabular-nums text-gold">{info.diasAtuais}</p>
        <p className="text-sm font-medium uppercase tracking-wide text-cream/80">
          dia{info.diasAtuais === 1 ? "" : "s"} sem acidentes
        </p>
        <p className="mt-2 text-xs text-cream/60">
          {info.ultimoAcidente
            ? `Último acidente registrado em ${formatDate(info.ultimoAcidente)}`
            : "Nenhum acidente registrado no histórico do sistema"}
        </p>
        <p className="text-xs text-cream/60">
          {isRecord ? "Este é o maior recorde já registrado! 🎉" : `Recorde atual: ${info.recordeDias} dias`}
        </p>
      </CardContent>
    </Card>
  );
}
