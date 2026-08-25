"use client";

import * as React from "react";
import { FileSearch, Users, UserCog, PenLine, FileSignature, BadgeCheck, ChevronDown, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { VacancyPipeline } from "@/services/recrutamento-timeline";

const STAGE_ORDER = ["TRIAGEM", "ENTREVISTA_RH", "ENTREVISTA_GESTOR", "TESTE", "PROPOSTA", "CONTRATADO"] as const;

const STAGE_META: Record<(typeof STAGE_ORDER)[number], { label: string; icon: typeof FileSearch }> = {
  TRIAGEM: { label: "Triagem", icon: FileSearch },
  ENTREVISTA_RH: { label: "Entrevista RH", icon: Users },
  ENTREVISTA_GESTOR: { label: "Entrevista Gestor", icon: UserCog },
  TESTE: { label: "Teste", icon: PenLine },
  PROPOSTA: { label: "Proposta", icon: FileSignature },
  CONTRATADO: { label: "Contratado", icon: BadgeCheck },
};

const URGENCY_STYLE: Record<VacancyPipeline["urgency"], { badge: "danger" | "warning" | "success"; label: string; bar: string }> = {
  CRITICA: { badge: "danger", label: "SLA estourado", bar: "bg-danger" },
  ATENCAO: { badge: "warning", label: "Atenção ao prazo", bar: "bg-warning" },
  OK: { badge: "success", label: "Dentro do prazo", bar: "bg-success" },
};

function stageIndex(stage: string): number {
  const i = (STAGE_ORDER as readonly string[]).indexOf(stage);
  return i === -1 ? 0 : i;
}

function chipTone(daysInStage: number): string {
  if (daysInStage > 7) return "border-danger/40 bg-danger/10 text-danger";
  if (daysInStage > 3) return "border-warning/40 bg-warning/10 text-warning-text";
  return "border-success/40 bg-success/10 text-success";
}

function VacancyPipelineCard({ vaga }: { vaga: VacancyPipeline }) {
  const [open, setOpen] = React.useState(true);
  const style = URGENCY_STYLE[vaga.urgency];

  // Progresso geral da vaga: quão longe o candidato mais avançado já chegou
  // no funil (0% = ninguém saiu da Triagem, 100% = alguém já em Contratado).
  const furthestIndex = vaga.candidates.reduce((max, c) => Math.max(max, stageIndex(c.stage)), 0);
  const progressPct = vaga.candidates.length === 0 ? 0 : Math.round((furthestIndex / (STAGE_ORDER.length - 1)) * 100);

  const byStage = new Map<string, typeof vaga.candidates>();
  for (const stage of STAGE_ORDER) byStage.set(stage, []);
  for (const c of vaga.candidates) byStage.get(c.stage)?.push(c);

  return (
    <div className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-navy dark:text-cream">{vaga.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {vaga.unit ?? "Sem unidade"} · {vaga.candidates.length} candidato(s) ativo(s)
              {vaga.rejectedCount > 0 && ` · ${vaga.rejectedCount} reprovado(s)`}
            </p>
          </div>
          {vaga.isCritical && <Badge variant="danger">Crítica</Badge>}
          <Badge variant={style.badge}>{vaga.daysOpen}d de {vaga.targetDays}d — {style.label}</Badge>
        </div>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      <div className="px-4 pb-1">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full transition-all", style.bar)} style={{ width: `${Math.max(4, progressPct)}%` }} />
        </div>
      </div>

      {open && (
        <div className="overflow-x-auto px-4 pb-4 pt-3">
          <div className="flex min-w-max items-start gap-0">
            {STAGE_ORDER.map((stageKey, i) => {
              const meta = STAGE_META[stageKey];
              const Icon = meta.icon;
              const candidatesHere = byStage.get(stageKey) ?? [];
              const reached = i <= furthestIndex;

              return (
                <div key={stageKey} className="flex items-start">
                  <div className="flex w-32 flex-col items-center gap-2">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full border",
                        candidatesHere.length > 0
                          ? "border-gold bg-gold/15 text-gold-text"
                          : reached
                            ? "border-navy/40 bg-navy/5 text-navy dark:border-cream/30 dark:text-cream"
                            : "border-border bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-center text-[11px] font-medium leading-tight">{meta.label}</p>
                    <div className="flex min-h-[24px] flex-col items-center gap-1">
                      {candidatesHere.length === 0 ? (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      ) : (
                        candidatesHere.map((c) => (
                          <span
                            key={c.id}
                            title={`${c.name} · ${c.daysInStage} dia(s) nesta etapa · origem: ${c.source}`}
                            className={cn(
                              "w-full max-w-[112px] truncate rounded-full border px-2 py-0.5 text-center text-[10px] font-medium",
                              chipTone(c.daysInStage)
                            )}
                          >
                            {c.name.split(" ")[0]} · {c.daysInStage}d
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                  {i < STAGE_ORDER.length - 1 && (
                    <div className={cn("mt-4 h-px w-6 shrink-0", i < furthestIndex ? "bg-gold" : "bg-border")} />
                  )}
                </div>
              );
            })}
          </div>

          {vaga.candidates.length === 0 && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <XCircle className="h-3.5 w-3.5" /> Nenhum candidato em andamento nesta vaga no momento.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function VacancyPipelineBoard({ vagas }: { vagas: VacancyPipeline[] }) {
  if (vagas.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma vaga em aberto no momento.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {vagas.map((v) => (
        <VacancyPipelineCard key={v.id} vaga={v} />
      ))}
    </div>
  );
}
