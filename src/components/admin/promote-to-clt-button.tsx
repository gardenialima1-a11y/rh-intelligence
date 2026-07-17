"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { promoteToClt } from "@/actions/promote-employee";

export function PromoteToCltButton({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handlePromote() {
    if (!confirm(`Promover ${employeeName} para CLT (efetivo)? O contrato deixa de ter data de término.`)) return;
    setLoading(true);
    const result = await promoteToClt(employeeId);
    setLoading(false);
    if (!result.success) {
      alert(result.error ?? "Não foi possível promover.");
      return;
    }
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={handlePromote} disabled={loading}>
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TrendingUp className="h-3.5 w-3.5" />}
      Promover a CLT
    </Button>
  );
}
