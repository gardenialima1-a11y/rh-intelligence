"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Mantém os dados da página sempre "ao vivo": busca os dados de novo no
 * servidor (router.refresh()) em intervalos regulares, sem precisar recarregar
 * a página nem perder o que o usuário está vendo. Pausa sozinho se a aba não
 * estiver visível ou se houver um formulário/diálogo aberto na tela, pra não
 * atrapalhar quem está cadastrando ou editando algo.
 */
export function LiveRefresher({ intervalSeconds = 25 }: { intervalSeconds?: number }) {
  const router = useRouter();
  const [secondsAgo, setSecondsAgo] = React.useState(0);
  const [paused, setPaused] = React.useState(false);
  const lastRefreshRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    lastRefreshRef.current = Date.now();

    const tick = window.setInterval(() => {
      if (lastRefreshRef.current === null) return;
      const elapsedMs = Date.now() - lastRefreshRef.current;
      setSecondsAgo(Math.floor(elapsedMs / 1000));

      const hasOpenDialog = document.querySelector('[role="dialog"]') !== null;
      const isHidden = document.visibilityState === "hidden";
      setPaused(hasOpenDialog || isHidden);

      if (!hasOpenDialog && !isHidden && elapsedMs >= intervalSeconds * 1000) {
        lastRefreshRef.current = Date.now();
        setSecondsAgo(0);
        router.refresh();
      }
    }, 1000);

    return () => window.clearInterval(tick);
  }, [router, intervalSeconds]);

  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className="relative flex h-2 w-2">
        {!paused && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
        )}
        <span className={cn("relative inline-flex h-2 w-2 rounded-full", paused ? "bg-muted-foreground/40" : "bg-success")} />
      </span>
      <RefreshCw className="h-3 w-3" />
      {paused ? "Atualização em tempo real pausada" : `Ao vivo — atualizado há ${secondsAgo}s`}
    </div>
  );
}
