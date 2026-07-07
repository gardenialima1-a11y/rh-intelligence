import { auth } from "@/lib/auth";
import type { ExecutiveFilters } from "@/services/dashboard-executivo";

/**
 * Perfis com visão corporativa (todas as unidades). Demais perfis
 * (GESTOR, SUPERVISOR, LIDER, USUARIO) só podem visualizar dados da
 * própria unidade, mesmo que tentem alterar o parâmetro `?unidade=` na URL.
 */
export const CORPORATE_ROLES = new Set(["ADMINISTRADOR", "RH", "DIRETORIA"]);

export async function resolveScopedFilters(params: {
  unidade?: string;
  periodo?: string;
}): Promise<ExecutiveFilters> {
  const session = await auth();
  const role = session?.user.role;
  const requestedUnitId = params.unidade;

  const unitId =
    role && CORPORATE_ROLES.has(role)
      ? requestedUnitId
      : (session?.user.unitId ?? undefined);

  return { unitId, period: params.periodo };
}
