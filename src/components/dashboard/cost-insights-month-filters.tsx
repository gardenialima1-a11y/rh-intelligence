"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRight } from "lucide-react";

function competenceLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const fmt = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" });
  return fmt.format(new Date(y, m - 1, 1)).replace(".", "");
}

/** "2026-07" -> "2026-06" (mês anterior, usado como valor padrão do segundo seletor). */
function previousMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function CostInsightsMonthFilters({ competences }: { competences: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const atual = searchParams.get("insightsAtual") ?? competences[0] ?? "";
  const comparar = searchParams.get("insightsComparar") ?? (atual ? previousMonthKey(atual) : "");

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`${pathname}?${params.toString()}#insights`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={atual} onValueChange={(v) => updateParam("insightsAtual", v)}>
        <SelectTrigger className="h-8 w-32 text-xs">
          <SelectValue placeholder="Mês" />
        </SelectTrigger>
        <SelectContent>
          {competences.map((c) => (
            <SelectItem key={c} value={c}>{competenceLabel(c)}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />

      <Select value={comparar} onValueChange={(v) => updateParam("insightsComparar", v)}>
        <SelectTrigger className="h-8 w-40 text-xs">
          <SelectValue placeholder="Comparar com" />
        </SelectTrigger>
        <SelectContent>
          {competences.map((c) => (
            <SelectItem key={c} value={c}>{competenceLabel(c)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
