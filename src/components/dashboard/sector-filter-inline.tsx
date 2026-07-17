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

interface SectorOption {
  id: string;
  name: string;
}

/**
 * Filtro de Setor principal / Setor secundário para usar dentro de um card
 * específico (ex.: acima de uma tabela). Usa os mesmos parâmetros de URL
 * (`setorPrincipal` e `setorSecundario`) que a barra de filtros global do
 * topo, então os dois ficam sempre sincronizados — mudar um, muda o outro.
 */
export function SectorFilterInline({ sectors }: { sectors: SectorOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentPrincipal = searchParams.get("setorPrincipal") ?? "todos";
  const currentSecundario = searchParams.get("setorSecundario") ?? "todos";

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "todos") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={currentPrincipal} onValueChange={(v) => updateParam("setorPrincipal", v)}>
        <SelectTrigger className="h-8 w-44 text-xs">
          <SelectValue placeholder="Setor principal" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os setores</SelectItem>
          {sectors.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={currentSecundario} onValueChange={(v) => updateParam("setorSecundario", v)}>
        <SelectTrigger className="h-8 w-44 text-xs">
          <SelectValue placeholder="Setor secundário" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos (secundário)</SelectItem>
          {sectors.map((s) => (
            <SelectItem key={`sec-${s.id}`} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
