import { PhoneCall, Users, UserCog, PenLine, FileSignature, Mail, MessageSquare, Circle } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { ACTIVITY_TYPE_LABEL } from "@/lib/validation/candidate-activity";

type ActivityType = keyof typeof ACTIVITY_TYPE_LABEL;

const ACTIVITY_ICON: Record<ActivityType, typeof PhoneCall> = {
  TRIAGEM_TELEFONICA: PhoneCall,
  ENTREVISTA_RH: Users,
  ENTREVISTA_GESTOR: UserCog,
  TESTE_APLICADO: PenLine,
  PROPOSTA_ENVIADA: FileSignature,
  EMAIL: Mail,
  MENSAGEM: MessageSquare,
  OUTRO: Circle,
};

export interface RecentActivityRow {
  id: string;
  type: string;
  occurredAt: Date;
  notes: string | null;
  candidate: { id: string; name: string; vacancy: string };
}

export function RecentActivitiesFeed({ activities }: { activities: RecentActivityRow[] }) {
  if (activities.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nenhum contato registrado ainda. Use o botão de telefone na tabela de candidatos para começar.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {activities.map((a) => {
        const type = a.type as ActivityType;
        const Icon = ACTIVITY_ICON[type] ?? Circle;
        return (
          <div key={a.id} className="flex items-start gap-3 rounded-md px-3 py-2 hover:bg-muted">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold-text">
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-medium">{a.candidate.name}</span>
                <span className="text-muted-foreground"> · {ACTIVITY_TYPE_LABEL[type] ?? a.type}</span>
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {a.candidate.vacancy} — {formatDate(a.occurredAt)}
                {a.notes ? ` · ${a.notes}` : ""}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
