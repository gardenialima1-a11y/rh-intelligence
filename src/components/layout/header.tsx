import { GlobalSearch } from "@/components/layout/global-search";
import { NotificationsMenu } from "@/components/layout/notifications-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Separator } from "@/components/ui/separator";
import type { Session } from "next-auth";

export async function Header({ session, favoriteKeys }: { session: Session; favoriteKeys: string[] }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-card/85 px-5 shadow-[var(--shadow-xs)] backdrop-blur-md">
      <MobileNav role={session.user.role} favoriteKeys={favoriteKeys} />
      <GlobalSearch />
      <div className="flex-1" />
      <NotificationsMenu />
      <ThemeToggle />
      <Separator orientation="vertical" className="h-6" />
      <UserMenu name={session.user?.name} email={session.user?.email} role={session.user.role} />
    </header>
  );
}
