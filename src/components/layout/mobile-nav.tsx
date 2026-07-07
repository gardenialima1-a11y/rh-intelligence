"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Menu, Building2, X, Star } from "lucide-react";
import { MODULES, modulesByGroup, type ModuleDef } from "@/lib/modules";
import { cn } from "@/lib/utils";
import type { Role } from "@prisma/client";

function moduleHref(slug: string) {
  return slug === "" ? "/" : `/modulos/${slug}`;
}

function MobileNavLink({ module: m, isActive, onNavigate }: { module: ModuleDef; isActive: boolean; onNavigate: () => void }) {
  const Icon = m.icon;
  return (
    <Link
      href={moduleHref(m.slug)}
      onClick={onNavigate}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[13.5px] transition-colors",
        isActive ? "bg-navy text-cream font-medium" : "text-foreground/80 hover:bg-muted"
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-gold" : "text-muted-foreground")} />
      <span className="truncate">{m.shortName}</span>
    </Link>
  );
}

export function MobileNav({ role, favoriteKeys }: { role: Role; favoriteKeys: string[] }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const groups = modulesByGroup();
  const favoriteModules = MODULES.filter((m) => favoriteKeys.includes(m.key));
  const close = () => setOpen(false);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <button className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-muted lg:hidden" aria-label="Abrir menu">
          <Menu className="h-5 w-5" />
        </button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] lg:hidden" />
        <DialogPrimitive.Content className="fixed left-0 top-0 z-50 flex h-full w-72 flex-col bg-card shadow-[var(--shadow-popover)] lg:hidden">
          <DialogPrimitive.Title className="sr-only">Menu de navegação</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Lista de módulos da plataforma agrupados por categoria.
          </DialogPrimitive.Description>
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy text-gold">
                <Building2 className="h-4 w-4" />
              </div>
              <span className="text-sm font-semibold tracking-tight text-navy dark:text-cream">RH BI</span>
            </div>
            <DialogPrimitive.Close asChild>
              <button className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted" aria-label="Fechar menu">
                <X className="h-4 w-4" />
              </button>
            </DialogPrimitive.Close>
          </div>
          <nav className="flex-1 overflow-y-auto px-2.5 py-4">
            {favoriteModules.length > 0 && (
              <div className="mb-5">
                <p className="mb-1.5 flex items-center gap-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Star className="h-3 w-3 fill-gold text-gold" /> Favoritos
                </p>
                <div className="flex flex-col gap-0.5">
                  {favoriteModules.map((m) => (
                    <MobileNavLink key={m.key} module={m} isActive={pathname === moduleHref(m.slug)} onNavigate={close} />
                  ))}
                </div>
              </div>
            )}
            {groups.map(({ group, modules }) => {
              const visible = modules.filter((m) => !m.minRole || m.minRole.includes(role));
              if (visible.length === 0) return null;
              return (
                <div key={group} className="mb-5">
                  <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group}
                  </p>
                  <div className="flex flex-col gap-0.5">
                    {visible.map((m) => (
                      <MobileNavLink key={m.key} module={m} isActive={pathname === moduleHref(m.slug)} onNavigate={close} />
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
