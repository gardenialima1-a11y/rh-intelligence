"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Star } from "lucide-react";
import { toggleFavorite } from "@/actions/favorites";
import { cn } from "@/lib/utils";

export function FavoriteButton({ moduleKey, initialIsFavorite }: { moduleKey: string; initialIsFavorite: boolean }) {
  const [isFavorite, setIsFavorite] = React.useState(initialIsFavorite);
  const [isPending, startTransition] = React.useTransition();
  const pathname = usePathname();

  function handleClick() {
    setIsFavorite((prev) => !prev); // atualização otimista
    startTransition(async () => {
      try {
        await toggleFavorite(moduleKey, pathname);
      } catch {
        setIsFavorite((prev) => !prev); // reverte em caso de erro
      }
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
    >
      <Star className={cn("h-4 w-4", isFavorite && "fill-gold text-gold")} />
    </button>
  );
}
