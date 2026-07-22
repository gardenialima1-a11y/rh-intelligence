import { PartyPopper, Cake, Award, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TodayCelebration } from "@/services/aniversariantes";

function CelebrationRow({ person, kind }: { person: TodayCelebration; kind: "birthday" | "anniversary" }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/60 p-2.5">
      {person.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={person.photoUrl} alt={person.name} className="h-11 w-11 shrink-0 rounded-full object-cover" />
      ) : (
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy/10 text-navy dark:bg-cream/10 dark:text-cream">
          <User className="h-5 w-5" />
        </div>
      )}
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-[13.5px] font-semibold text-navy dark:text-cream">{person.name}</span>
        <span className="truncate text-[12px] text-muted-foreground">
          {person.position ?? "—"} · {person.unit}
        </span>
        <span className="mt-0.5 flex items-center gap-1 text-[11.5px] font-medium text-gold-text">
          {kind === "birthday" ? (
            <>
              <Cake className="h-3 w-3" /> Faz aniversário hoje{person.years ? ` (${person.years} anos)` : ""}
            </>
          ) : (
            <>
              <Award className="h-3 w-3" /> {person.years} {person.years === 1 ? "ano" : "anos"} de empresa hoje
            </>
          )}
        </span>
      </div>
    </div>
  );
}

export function TodaysCelebrationsCard({
  birthdays,
  workAnniversaries,
}: {
  birthdays: TodayCelebration[];
  workAnniversaries: TodayCelebration[];
}) {
  const total = birthdays.length + workAnniversaries.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PartyPopper className="h-4 w-4 text-gold-text" /> Comemorações de hoje
        </CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Ninguém faz aniversário nem completa tempo de empresa hoje.
          </p>
        ) : (
          <div className="flex max-h-80 flex-col gap-2 overflow-y-auto scrollbar-thin">
            {birthdays.map((p) => (
              <CelebrationRow key={`b-${p.id}`} person={p} kind="birthday" />
            ))}
            {workAnniversaries.map((p) => (
              <CelebrationRow key={`a-${p.id}`} person={p} kind="anniversary" />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
