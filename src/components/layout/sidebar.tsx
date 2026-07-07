"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MODULES, modulesByGroup, type ModuleDef } from "@/lib/modules";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, Star } from "lucide-react";
import type { Role } from "@prisma/client";

function moduleHref(slug: string) {
  return slug === "" ? "/" : `/modulos/${slug}`;
}

function NavLink({ module: m, isActive }: { module: ModuleDef; isActive: boolean }) {
  const Icon = m.icon;
  return (
    <Link
      href={moduleHref(m.slug)}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] transition-all duration-150",
        isActive
          ? "bg-navy text-cream font-medium shadow-[var(--shadow-sm)]"
          : "text-foreground/75 hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          isActive ? "text-gold" : "text-muted-foreground group-hover:text-foreground/70"
        )}
      />
      <span className="truncate">{m.shortName}</span>
    </Link>
  );
}

export function Sidebar({ role, favoriteKeys }: { role: Role; favoriteKeys: string[] }) {
  const pathname = usePathname();
  const groups = modulesByGroup();
  const favoriteModules = MODULES.filter((m) => favoriteKeys.includes(m.key));

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy text-gold shadow-[var(--shadow-xs)]">
          <Building2 className="h-4 w-4" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-semibold tracking-tight text-navy dark:text-cream">RH BI</span>
          <span className="text-[10px] text-muted-foreground">People Analytics Platform</span>
        </div>
      </div>

      <ScrollArea className="flex-1 px-2.5 py-4">
        <nav className="flex flex-col gap-5">
          {favoriteModules.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Star className="h-3 w-3 fill-gold text-gold" /> Favoritos
              </p>
              <div className="flex flex-col gap-0.5">
                {favoriteModules.map((m) => (
                  <NavLink key={m.key} module={m} isActive={pathname === moduleHref(m.slug)} />
                ))}
              </div>
            </div>
          )}

          {groups.map(({ group, modules }) => {
            const visible = modules.filter((m) => !m.minRole || m.minRole.includes(role));
            if (visible.length === 0) return null;
            return (
              <div key={group}>
                <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group}
                </p>
                <div className="flex flex-col gap-0.5">
                  {visible.map((m) => (
                    <NavLink key={m.key} module={m} isActive={pathname === moduleHref(m.slug)} />
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
      </ScrollArea>
    </aside>
  );
}
