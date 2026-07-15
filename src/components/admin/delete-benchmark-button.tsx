"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteSalaryBenchmark } from "@/actions/salary-benchmark";

export function DeleteBenchmarkButton({ positionId }: { positionId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("Remover este cargo do benchmarking? Os dados de salário da empresa continuam intactos, só a referência de mercado é apagada.")) return;
    setLoading(true);
    await deleteSalaryBenchmark(positionId);
    setLoading(false);
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={handleDelete} disabled={loading}>
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
    </Button>
  );
}
