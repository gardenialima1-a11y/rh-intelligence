"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, Check, Users2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { updateTargetHeadcount } from "@/actions/target-headcount";
import type { IdealVsRealArea } from "@/services/headcount";

function DiffBadge({ diff }: { diff: number }) {
  if (diff === 0) return <Badge variant="success">Completo</Badge>;
  if (diff > 0) return <Badge variant="gold">+{diff} acima</Badge>;
  return <Badge variant="danger">Faltam {Math.abs(diff)}</Badge>;
}

function EditableIdeal({ costCenterId, initialValue }: { costCenterId: string; initialValue: number | null }) {
  const [value, setValue] = React.useState(initialValue !== null ? String(initialValue) : "");
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const router = useRouter();

  async function handleBlur() {
    const parsed = value.trim() === "" ? null : Number(value);
    if (parsed === initialValue) return;
    setSaving(true);
    setSaved(false);
    const result = await updateTargetHeadcount(costCenterId, parsed);
    setSaving(false);
    if (result.success) {
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 1500);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} onBlur={handleBlur} className="h-8 w-20" placeholder="—" />
      {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      {saved && <Check className="h-3.5 w-3.5 text-success" />}
    </div>
  );
}

function AreaCard({ area }: { area: IdealVsRealArea }) {
  const [open, setOpen] = React.useState(false);

  return (
    <Card className="overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-4 p-4 text-left">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy/10 text-navy dark:bg-cream/10 dark:text-cream">
            <Users2 className="h-[18px] w-[18px]" />
          </div>
          <div className="flex flex-col">
            <span className="text-[14.5px] font-semibold text-navy dark:text-cream">{area.area}</span>
            <span className="text-[12px] text-muted-foreground">
              Ideal {area.ideal} · Real {area.real}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <DiffBadge diff={area.diff} />
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {open && (
        <CardContent className="border-t border-border pt-3">
          <div className="flex flex-col gap-2">
            {area.sectors.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-2.5">
                <span className="min-w-0 flex-1 truncate text-[13px]">{s.name}</span>
                <div className="flex shrink-0 items-center gap-4">
                  <EditableIdeal costCenterId={s.id} initialValue={s.ideal} />
                  <span className="w-10 text-center text-[13px] font-semibold">{s.real}</span>
                  {s.diff === null ? <span className="w-24 text-center text-muted-foreground">—</span> : <div className="w-24"><DiffBadge diff={s.diff} /></div>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

export function IdealVsRealAreaCards({ areas }: { areas: IdealVsRealArea[] }) {
  if (areas.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nenhum quadro ideal cadastrado ainda.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {areas.map((a) => (
        <AreaCard key={a.area} area={a} />
      ))}
    </div>
  );
}
