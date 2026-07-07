import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { GlobalSearch } from "@/components/layout/global-search";
import { GlobalFilterBar } from "@/components/layout/global-filter-bar";
import { NotificationsMenu } from "@/components/layout/notifications-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Separator } from "@/components/ui/separator";
import { CORPORATE_ROLES } from "@/lib/scope";
import type { Session } from "next-auth";

export async function Header({ session, favoriteKeys }: { session: Session; favoriteKeys: string[] }) {
  const units = await prisma.unit.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  const canPickUnit = CORPORATE_ROLES.has(session.user.role);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-card/85 px-5 shadow-[var(--shadow-xs)] backdrop-blur-md">
      <MobileNav role={session.user.role} favoriteKeys={favoriteKeys} />
      <GlobalSearch />
      <div className="flex-1" />
      <Suspense fallback={<div className="h-8 w-64" />}>
        <GlobalFilterBar units={units} canPickUnit={canPickUnit} />
      </Suspense>
      <Separator orientation="vertical" className="hidden h-6 md:block" />
      <NotificationsMenu />
      <ThemeToggle />
      <Separator orientation="vertical" className="h-6" />
      <UserMenu name={session.user?.name} email={session.user?.email} role={session.user.role} />
    </header>
  );
}
