"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export function OcorrenciasFilterBar({ months }: { months: { value: string; label: string }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentMes = searchParams.get("mes") ?? "todos";
  const [busca, setBusca] = React.useState(searchParams.get("busca") ?? "");

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "todos") params.delete(key);
    else params.set(key, value);
    router.push(`${pathname}?${params.toString()}#ocorrencias`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={currentMes} onValueChange={(v) => updateParam("mes", v)}>
        <SelectTrigger className="h-8 w-40 text-xs">
          <SelectValue placeholder="Mês" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os meses</SelectItem>
          {months.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateParam("busca", busca);
        }}
        className="flex items-center gap-1.5"
      >
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar colaborador..."
          className="h-8 w-52 text-xs"
        />
        <Button type="submit" size="sm" variant="outline" className="gap-1">
          <Search className="h-3.5 w-3.5" /> Buscar
        </Button>
        {(currentMes !== "todos" || searchParams.get("busca")) && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setBusca("");
              const params = new URLSearchParams(searchParams.toString());
              params.delete("mes");
              params.delete("busca");
              router.push(`${pathname}?${params.toString()}#ocorrencias`);
            }}
          >
            Limpar
          </Button>
        )}
      </form>
    </div>
  );
}
