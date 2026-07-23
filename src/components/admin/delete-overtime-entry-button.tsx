"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteOvertimeEntry } from "@/actions/overtime-manual";

export function DeleteOvertimeEntryButton({ entryId, employeeName }: { entryId: string; employeeName: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm(`Excluir o lançamento de hora extra de "${employeeName}"?`)) return;
    setLoading(true);
    const result = await deleteOvertimeEntry(entryId);
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
