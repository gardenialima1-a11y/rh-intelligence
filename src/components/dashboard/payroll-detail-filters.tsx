"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function competenceLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  const fmt = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
  return fmt.format(new Date(y, m - 1, 1));
}

export function PayrollDetailFilters({
  competences,
  employees,
}: {
  competences: string[];
  employees: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentMes = searchParams.get("mes") ?? competences[0] ?? "";
  const currentColaborador = searchParams.get("colaborador") ?? "todos";

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "todos" || !value) params.delete(key);
    else params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={currentMes} onValueChange={(v) => updateParam("mes", v)}>
        <SelectTrigger className="h-8 w-40 text-xs">
          <SelectValue placeholder="Mês" />
        </SelectTrigger>
        <SelectContent>
          {competences.map((c) => (
            <SelectItem key={c} value={c}>
              {competenceLabel(c)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={currentColaborador} onValueChange={(v) => updateParam("colaborador", v)}>
        <SelectTrigger className="h-8 w-52 text-xs">
          <SelectValue placeholder="Colaborador" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos os colaboradores</SelectItem>
          {employees.map((e) => (
            <SelectItem key={e.id} value={e.id}>
              {e.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
