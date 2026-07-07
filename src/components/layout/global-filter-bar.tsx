"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface UnitOption {
  id: string;
  name: string;
}

const PERIOD_OPTIONS = [
  { value: "30d", label: "Últimos 30 dias" },
  { value: "90d", label: "Últimos 90 dias" },
  { value: "12m", label: "Últimos 12 meses" },
  { value: "ytd", label: "Ano corrente (YTD)" },
];

export function GlobalFilterBar({ units, canPickUnit = true }: { units: UnitOption[]; canPickUnit?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentUnit = searchParams.get("unidade") ?? "todas";
  const currentPeriod = searchParams.get("periodo") ?? "12m";

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "todas") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="hidden items-center gap-2 md:flex">
      {canPickUnit && (
        <Select value={currentUnit} onValueChange={(v) => updateParam("unidade", v)}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="Unidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as unidades</SelectItem>
            {units.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Select value={currentPeriod} onValueChange={(v) => updateParam("periodo", v)}>
        <SelectTrigger className="h-8 w-44 text-xs">
          <SelectValue placeholder="Período" />
        </SelectTrigger>
        <SelectContent>
          {PERIOD_OPTIONS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
