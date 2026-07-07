import { redirect } from "next/navigation";
import { User, Mail, Building2, ShieldCheck } from "lucide-react";
import { auth } from "@/lib/auth";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ThemePreference } from "@/components/dashboard/theme-preference";
import { ROLE_LABEL } from "@/lib/labels";
import { prisma } from "@/lib/prisma";

export default async function PerfilPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const unit = session.user.unitId
    ? await prisma.unit.findUnique({ where: { id: session.user.unitId }, select: { name: true } })
    : null;

  const initials = (session.user.name ?? session.user.email ?? "U")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      <ModuleHeader title="Meu Perfil" description="Informações da sua conta e preferências de exibição da plataforma." />

      <Card>
        <CardContent className="flex items-center gap-4 p-5">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="text-lg">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <span className="text-lg font-semibold text-navy dark:text-cream">{session.user.name ?? "Usuário"}</span>
            <Badge variant="gold" className="w-fit">
              {ROLE_LABEL[session.user.role] ?? session.user.role}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dados da conta</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span>{session.user.email}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <span>Perfil de acesso: {ROLE_LABEL[session.user.role] ?? session.user.role}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span>Unidade: {unit?.name ?? "Todas as unidades (visão corporativa)"}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span>ID de usuário: {session.user.id}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferências de exibição</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">Tema da interface</p>
          <ThemePreference />
        </CardContent>
      </Card>
    </div>
  );
}
