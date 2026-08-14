"use client";

import {
  FileSearch,
  ClipboardList,
  FileCheck2,
  Users,
  PenLine,
  FileSignature,
  BadgeCheck,
} from "lucide-react";

type StageDatum = { stage: string; avgDays: number; count: number };

const STAGE_META: Record<string, { label: string; icon: typeof FileSearch }> = {
  TRIAGEM: { label: "Triagem", icon: FileSearch },
  CADASTRO: { label: "Cadastro", icon: ClipboardList },
  ANALISE_CPF: { label: "Análise CPF", icon: FileCheck2 },
  ENTREVISTA_RH: { label: "Entrevista", icon: Users },
  TESTE: { label: "Testes", icon: PenLine },
  PROPOSTA: { label: "Proposta", icon: FileSignature },
  ADMISSAO: { label: "Admissão", icon: BadgeCheck },
};

const ORDER = [
  "TRIAGEM",
  "CADASTRO",
  "ANALISE_CPF",
  "ENTREVISTA_RH",
  "TESTE",
  "PROPOSTA",
  "ADMISSAO",
];

export function RecruitmentStageTimeline({ data }: { data: StageDatum[] }) {
  const byStage = Object.fromEntries(data.map((d) => [d.stage, d]));
  const maxDays = Math.max(1, ...data.map((d) => d.avgDays));

  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="flex min-w-max items-start">
        {ORDER.map((stageKey, i) => {
          const meta = STAGE_META[stageKey];
          const stat = byStage[stageKey];
          const Icon = meta.icon;
          const isSlow = stat && stat.avgDays > maxDays * 0.6;

          return (
            <div key={stageKey} className="flex items-start">
              <div className="flex w-24 flex-col items-center gap-2">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-full border ${
                    isSlow
                      ? "border-amber-500 bg-amber-50 text-amber-600 dark:bg-amber-950/40"
                      : "border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <p className="text-center text-xs font-medium">{meta.label}</p>
                <p className="text-center text-[11px] text-muted-foreground">
                  {stat ? `${stat.avgDays}d` : "—"}
                </p>
                <p className="text-center text-[10px] text-muted-foreground">
                  {stat ? `${stat.count} candidato(s)` : ""}
                </p>
              </div>
              {i < ORDER.length - 1 && <div className="mt-[18px] h-px w-10 bg-border" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
