"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { updateManagerHierarchy } from "@/actions/reference-data";

interface ManagerOption {
  id: string;
  name: string;
}

export function EditHierarchyButton({ managerId, managers }: { managerId: string; managers: ManagerOption[] }) {
  const [loading, setLoading] = React.useState(false);
  const router = useRouter();

  async function handleSelect(reportsToId: string | null) {
    setLoading(true);
    await updateManagerHierarchy(managerId, reportsToId);
    setLoading(false);
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="ml-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
          aria-label="Editar quem este gestor reporta"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Pencil className="h-3.5 w-3.5" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
        <DropdownMenuLabel>Reporta para</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => handleSelect(null)}>Ninguém (topo da hierarquia)</DropdownMenuItem>
        {managers
          .filter((m) => m.id !== managerId)
          .map((m) => (
            <DropdownMenuItem key={m.id} onClick={() => handleSelect(m.id)}>
              {m.name}
            </DropdownMenuItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
