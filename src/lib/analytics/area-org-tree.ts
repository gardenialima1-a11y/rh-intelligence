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
  photoUrl: string | null;
}

export interface AreaOrgNode {
  id: string;
  name: string;
  subtitle: string | null;
  isManager: boolean;
  directCount: number;
  photoUrl: string | null;
  children: AreaOrgNode[];
}

function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toUpperCase();
}

/**
 * Monta o organograma de UM setor principal, com gestores no topo e
 * colaboradores reais como folhas embaixo do seu gestor direto.
 *
 * Só entram pessoas que realmente existem no cadastro de Colaboradores
 * (casadas pelo nome). Um "gestor" que não bate com nenhum colaborador
 * cadastrado é removido da árvore, mas quem reportava a ele não some —
 * a linha "pula" esse gestor e reconecta direto no superior dele (ou na
 * raiz do setor, se ele também não tinha superior cadastrado).
 */
export function buildAreaOrgTree(
  area: string,
  managers: AreaManagerInput[],
  employees: AreaEmployeeInput[]
): AreaOrgNode[] {
  const areaManagers = managers.filter((m) => m.area === area);
  const employeeByName = new Map(employees.map((e) => [normalizeName(e.name), e]));

  const registeredManagerIds = new Set<string>();
  const managerEmployee = new Map<string, AreaEmployeeInput>();
  for (const m of areaManagers) {
    const emp = employeeByName.get(normalizeName(m.name));
    if (emp) {
      registeredManagerIds.add(m.id);
      managerEmployee.set(m.id, emp);
    }
  }

  const managerById = new Map(areaManagers.map((m) => [m.id, m]));

  function resolveEffectiveParent(managerId: string): string | null {
    let parentId = managerById.get(managerId)?.reportsToId ?? null;
    const seen = new Set<string>();
    while (parentId && !seen.has(parentId)) {
      if (registeredManagerIds.has(parentId)) return parentId;
      seen.add(parentId);
      parentId = managerById.get(parentId)?.reportsToId ?? null;
    }
    return null;
  }

  const nodeById = new Map<string, AreaOrgNode>();
  for (const m of areaManagers) {
    if (!registeredManagerIds.has(m.id)) continue;
    const emp = managerEmployee.get(m.id)!;
    nodeById.set(m.id, { id: m.id, name: m.name, subtitle: m.level, isManager: true, directCount: 0, photoUrl: emp.photoUrl, children: [] });
  }

  const roots: AreaOrgNode[] = [];
  for (const m of areaManagers) {
    if (!registeredManagerIds.has(m.id)) continue;
    const node = nodeById.get(m.id)!;
    const parentId = resolveEffectiveParent(m.id);
    if (parentId && nodeById.has(parentId) && parentId !== m.id) {
      nodeById.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  roots.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const canonicalRoot = roots[0] ?? null;
  for (let i = 1; i < roots.length; i++) {
    canonicalRoot!.children.push(roots[i]);
  }

  const registeredManagerNames = new Set(
    Array.from(registeredManagerIds).map((id) => normalizeName(managerById.get(id)!.name))
  );

  const areaEmployees = employees.filter((e) => e.area === area && !registeredManagerNames.has(normalizeName(e.name)));
  for (const e of areaEmployees) {
    const leaf: AreaOrgNode = { id: `emp-${e.id}`, name: e.name, subtitle: e.position, isManager: false, directCount: 0, photoUrl: e.photoUrl, children: [] };
    const directManagerId = e.managerId;
    const effectiveManagerId =
      directManagerId && registeredManagerIds.has(directManagerId)
        ? directManagerId
        : directManagerId
          ? resolveEffectiveParent(directManagerId)
          : null;
    const managerNode = effectiveManagerId ? nodeById.get(effectiveManagerId) : undefined;
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
