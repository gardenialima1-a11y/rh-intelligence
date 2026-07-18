"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteManager } from "@/actions/reference-data";

export function DeleteManagerButton({ managerId, managerName }: { managerId: string; managerName: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm(`Excluir o gestor "${managerName}"? Colaboradores que reportavam a ele ficam sem gestor direto, e quem reportava a ele passa a reportar para o superior dele.`)) return;
    setLoading(true);
    const result = await deleteManager(managerId);
    setLoading(false);
    if (!result.success) {
      alert(result.error ?? "Não foi possível excluir.");
      return;
    }
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={handleDelete} disabled={loading}>
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
    </Button>
  );
}
