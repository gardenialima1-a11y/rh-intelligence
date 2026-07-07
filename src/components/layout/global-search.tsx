"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search } from "lucide-react";
import { MODULES } from "@/lib/modules";
import { cn } from "@/lib/utils";

export function GlobalSearch() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const router = useRouter();

  React.useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const results = MODULES.filter((m) =>
    m.name.toLowerCase().includes(query.toLowerCase())
  );

  function go(slug: string) {
    setOpen(false);
    setQuery("");
    router.push(slug === "" ? "/" : `/modulos/${slug}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && results.length > 0) {
      e.preventDefault();
      go(results[0].slug);
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) setQuery("");
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Trigger asChild>
        <button
          aria-label="Buscar indicador"
          className="flex h-9 w-9 items-center justify-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm text-muted-foreground shadow-sm hover:bg-muted sm:w-56 sm:justify-start"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="hidden flex-1 text-left sm:inline">Buscar indicador...</span>
          <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] sm:inline">⌘K</kbd>
        </button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <DialogPrimitive.Content className="fixed left-1/2 top-24 z-50 w-full max-w-lg -translate-x-1/2 rounded-xl border border-border bg-popover p-2 shadow-xl">
          <DialogPrimitive.Title className="sr-only">Busca global</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Busque por nome de módulo ou indicador e pressione Enter ou clique para navegar até ele.
          </DialogPrimitive.Description>
          <input
            autoFocus
            aria-label="Buscar indicador ou módulo"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite o nome de um módulo ou indicador..."
            className="mb-2 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none"
          />
          <div className="max-h-80 overflow-y-auto">
            {results.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhum módulo encontrado.</p>
            )}
            {results.map((m) => (
              <button
                key={m.key}
                onClick={() => go(m.slug)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                )}
              >
                <m.icon className="h-4 w-4 text-gold" />
                <span>{m.name}</span>
              </button>
            ))}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
