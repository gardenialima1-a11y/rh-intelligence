import Link from "next/link";
import { Compass, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-navy-dark px-4"
      style={{
        backgroundImage:
          "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(184,147,90,0.16), transparent), radial-gradient(ellipse 60% 50% at 100% 100%, rgba(44,66,112,0.4), transparent)",
      }}
    >
      <Card className="max-w-md text-center shadow-[var(--shadow-popover)]">
        <CardContent className="flex flex-col items-center gap-4 p-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/12 text-gold-text">
            <Compass className="h-7 w-7" strokeWidth={2.25} />
          </div>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-lg font-semibold text-navy dark:text-cream">Página não encontrada</h2>
            <p className="text-[13.5px] leading-relaxed text-muted-foreground">
              O indicador ou módulo que você procura não existe ou foi movido.
            </p>
          </div>
          <Button variant="gold" asChild>
            <Link href="/">
              <Home className="h-4 w-4" /> Voltar ao Dashboard Executivo
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
