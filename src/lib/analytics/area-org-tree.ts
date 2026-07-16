export interface AreaManagerInput {
  id: string;
  name: string;
  area: string;
  level: string | null;
  reportsToId: string | null;
}

export interface AreaEmployeeInput {
  id: string;
  name: string;
  position: string | null;
  managerId: string | null;
  area: string | null;
}

export interface AreaOrgNode {
  id: string;
  name: string;
  subtitle: string | null;
  isManager: boolean;
  directCount: number;
  children: AreaOrgNode[];
}

/**
 * Monta o organograma de UM setor principal (Administrativo, Comercial,
 * Logística, Produção), com gestores no topo e colaboradores reais como
 * folhas embaixo do seu gestor direto. Gestores sem superior registrado
 * (reportsToId vazio ou apontando pra fora do setor) ficam pendurados no
 * primeiro gestor em ordem alfabética — que passa a fazer as vezes de
 * "topo" do setor (normalmente é quem só responde à diretoria).
 */
export function buildAreaOrgTree(
  area: string,
  managers: AreaManagerInput[],
  employees: AreaEmployeeInput[]
): AreaOrgNode[] {
  const areaManagers = managers.filter((m) => m.area === area);

  const nodeById = new Map<string, AreaOrgNode>();
  for (const m of areaManagers) {
    nodeById.set(m.id, { id: m.id, name: m.name, subtitle: m.level, isManager: true, directCount: 0, children: [] });
  }

  const roots: AreaOrgNode[] = [];
  for (const m of areaManagers) {
    const node = nodeById.get(m.id)!;
    if (m.reportsToId && nodeById.has(m.reportsToId) && m.reportsToId !== m.id) {
      nodeById.get(m.reportsToId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  roots.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const canonicalRoot = roots[0] ?? null;
  for (let i = 1; i < roots.length; i++) {
    canonicalRoot!.children.push(roots[i]);
  }

  const areaEmployees = employees.filter((e) => e.area === area);
  for (const e of areaEmployees) {
    const leaf: AreaOrgNode = { id: `emp-${e.id}`, name: e.name, subtitle: e.position, isManager: false, directCount: 0, children: [] };
    const managerNode = e.managerId ? nodeById.get(e.managerId) : undefined;
    if (managerNode) {
      managerNode.children.push(leaf);
      managerNode.directCount += 1;
    } else if (canonicalRoot) {
      canonicalRoot.children.push(leaf);
    }
  }

  const sortTree = (nodes: AreaOrgNode[]) => {
    nodes.sort((a, b) => {
      if (a.isManager !== b.isManager) return a.isManager ? -1 : 1;
      return a.name.localeCompare(b.name, "pt-BR");
    });
    nodes.forEach((n) => sortTree(n.children));
  };
  if (canonicalRoot) sortTree(canonicalRoot.children);

  return canonicalRoot ? [canonicalRoot] : [];
}
