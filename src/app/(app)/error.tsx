"use client";

import * as React from "react";
import Link from "next/link";
import { AlertOctagon, RotateCcw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ModuleError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error("Erro em módulo da plataforma:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="max-w-md text-center">
        <CardContent className="flex flex-col items-center gap-4 p-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/10 text-danger">
            <AlertOctagon className="h-7 w-7" strokeWidth={2.25} />
          </div>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-lg font-semibold text-navy dark:text-cream">Algo não saiu como esperado</h2>
            <p className="text-[13.5px] leading-relaxed text-muted-foreground">
              Houve um erro ao carregar este módulo. Você pode tentar novamente ou voltar ao Dashboard Executivo.
              {error.digest && <span className="mt-1 block text-xs text-muted-foreground/70">Código de referência: {error.digest}</span>}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => reset()}>
              <RotateCcw className="h-4 w-4" /> Tentar novamente
            </Button>
            <Button variant="gold" asChild>
              <Link href="/">
                <Home className="h-4 w-4" /> Ir para o início
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
