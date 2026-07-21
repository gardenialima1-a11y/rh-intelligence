import { redirect } from "next/navigation";
import { Users, Target, ShieldCheck, RefreshCw } from "lucide-react";
import { auth } from "@/lib/auth";
import { ModuleHeader } from "@/components/dashboard/module-header";
import { ModuleViewTabs } from "@/components/dashboard/module-view-tabs";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatDate } from "@/lib/utils";
import { ROLE_LABEL } from "@/lib/labels";
import { getAdminUsers, getAdminGoals, getAdminAccessLogs, getDataFreshness } from "@/services/administracao";
import { listAdminAccounts } from "@/actions/admin-users";
import { AdminAccountsPanel } from "@/components/admin/admin-accounts-panel";

export default async function AdministracaoPage() {
  // Defesa em profundidade: além do bloqueio em src/proxy.ts, a própria página
  // revalida o perfil no servidor antes de consultar qualquer dado administrativo.
  const session = await auth();
  if (session?.user.role !== "ADMINISTRADOR") redirect("/");

  const [users, goals, accessLogs, freshness, adminAccounts] = await Promise.all([
    getAdminUsers(),
    getAdminGoals(),
    getAdminAccessLogs(),
    getDataFreshness(),
    listAdminAccounts(),
  ]);

  const executive = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Usuários ativos" value={formatNumber(users.length)} icon={Users} accent="navy" />
        <KpiCard label="Metas cadastradas" value={formatNumber(goals.length)} icon={Target} accent="gold" />
        <KpiCard label="Perfis de acesso" value="7" icon={ShieldCheck} accent="success" />
        <KpiCard label="Fontes monitoradas" value={formatNumber(freshness.length)} icon={RefreshCw} accent="navy" />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Última atualização por fonte de dados</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fonte</TableHead>
                <TableHead>Última atualização</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {freshness.map((f) => (
                <TableRow key={f.source}>
                  <TableCell>{f.source}</TableCell>
                  <TableCell>{f.lastUpdate ? formatDate(f.lastUpdate) : <Badge variant="danger">Sem dados</Badge>}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );

  const managerial = (
    <Card>
      <CardHeader>
        <CardTitle>Metas por indicador</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Módulo</TableHead>
              <TableHead>Indicador</TableHead>
              <TableHead>Meta</TableHead>
              <TableHead>Comparador</TableHead>
              <TableHead>Ano</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {goals.map((g) => (
              <TableRow key={g.id}>
                <TableCell>{g.moduleKey}</TableCell>
                <TableCell>{g.indicator}</TableCell>
                <TableCell>{g.targetValue}</TableCell>
                <TableCell>{g.comparator}</TableCell>
                <TableCell>{g.periodYear}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  const operational = (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Usuários da plataforma</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Criado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    <Badge variant="gold">{ROLE_LABEL[u.role] ?? u.role}</Badge>
                  </TableCell>
                  <TableCell>{u.unit?.name ?? "—"}</TableCell>
                  <TableCell>{formatDate(u.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AdminAccountsPanel accounts={adminAccounts} />
    </div>
  );

  const analytical = (
    <Card>
      <CardHeader>
        <CardTitle>Log de acessos recentes</CardTitle>
      </CardHeader>
      <CardContent>
        {accessLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum acesso registrado ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Rota</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accessLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{log.user.name ?? log.user.email}</TableCell>
                  <TableCell>{log.path}</TableCell>
                  <TableCell>{log.action}</TableCell>
                  <TableCell>{formatDate(log.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader title="Administração e Configurações" description="Usuários, perfis de acesso, metas, integrações e parametrização da plataforma." moduleKey="administracao" />
      <ModuleViewTabs executive={executive} managerial={managerial} operational={operational} analytical={analytical} />
    </div>
  );
}
