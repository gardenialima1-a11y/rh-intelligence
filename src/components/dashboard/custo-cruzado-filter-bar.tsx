"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

/**
 * Filtro por mês + nome (e, opcionalmente, status) reutilizado pelas duas
 * tabelas do cruzamento Ponto x Folha (custo real de atestados e faltas
 * injustificadas). Usa um prefixo próprio nos parâmetros da URL (ex.:
 * "atestado", "falta") pra não colidir com o filtro de Ocorrências, que já
 * usa "mes"/"busca" no mesmo módulo.
 */
export function CustoCruzadoFilterBar({
  paramPrefix,
  months,
  statusOptions,
  anchorId,
  buscaPlaceholder = "Buscar colaborador...",
}: {
  paramPrefix: string;
  months: { value: string; label: string }[];
  statusOptions?: { value: string; label: string }[];
  anchorId: string;
  buscaPlaceholder?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const mesParam = `${paramPrefix}Mes`;
  const buscaParam = `${paramPrefix}Busca`;
  const statusParam = `${paramPrefix}Status`;

  const currentMes = searchParams.get(mesParam) ?? "todos";
  const currentStatus = searchParams.get(statusParam) ?? "todos";
  const [busca, setBusca] = React.useState(searchParams.get(buscaParam) ?? "");

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "todos") params.delete(key);
    else params.set(key, value);
    router.push(`${pathname}?${params.toString()}#${anchorId}`);
  }

  const hasFilter = currentMes !== "todos" || Boolean(searchParams.get(buscaParam)) || (statusOptions && currentStatus !== "todos");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={currentMes} onValueChange={(v) => updateParam(mesParam, v)}>
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

      {statusOptions && (
        <Select value={currentStatus} onValueChange={(v) => updateParam(statusParam, v)}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            {statusOptions.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateParam(buscaParam, busca);
        }}
        className="flex items-center gap-1.5"
      >
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={buscaPlaceholder}
          className="h-8 w-52 text-xs"
        />
        <Button type="submit" size="sm" variant="outline" className="gap-1">
          <Search className="h-3.5 w-3.5" /> Buscar
        </Button>
        {hasFilter && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setBusca("");
              const params = new URLSearchParams(searchParams.toString());
              params.delete(mesParam);
              params.delete(buscaParam);
              params.delete(statusParam);
              router.push(`${pathname}?${params.toString()}#${anchorId}`);
            }}
          >
            Limpar
          </Button>
        )}
      </form>
    </div>
  );
}
