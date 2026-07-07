import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFavoriteModuleKeys } from "@/actions/favorites";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const pathname = (await headers()).get("x-pathname") ?? "/";
  prisma.accessLog
    .create({ data: { userId: session.user.id, path: pathname, action: "VIEW" } })
    .catch(() => {
      // log de acesso é best-effort; nunca deve quebrar a navegação
    });

  const favoriteKeys = await getFavoriteModuleKeys();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar role={session.user.role} favoriteKeys={favoriteKeys} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header session={session} favoriteKeys={favoriteKeys} />
        <main className="flex-1 overflow-y-auto scrollbar-thin px-5 py-6 lg:px-8">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
