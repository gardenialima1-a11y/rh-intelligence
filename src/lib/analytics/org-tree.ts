export interface OrgChartInput {
  id: string;
  name: string;
  area: string;
  level: string | null;
  reportsToId: string | null;
  directEmployeeCount: number;
}

export interface OrgChartNode {
  id: string;
  name: string;
  area: string;
  level: string | null;
  directEmployeeCount: number;
  children: OrgChartNode[];
}

/**
 * Constrói a árvore hierárquica de gestores a partir de uma lista plana.
 * Gestores sem "reportsToId" (ou cujo superior não existe na lista) viram raízes,
 * o que evita que um vínculo quebrado (ex.: apagado) trave o organograma inteiro.
 */
export function buildOrgTree(managers: OrgChartInput[]): OrgChartNode[] {
  const nodeById = new Map<string, OrgChartNode>();
  for (const m of managers) {
    nodeById.set(m.id, {
      id: m.id,
      name: m.name,
      area: m.area,
      level: m.level,
      directEmployeeCount: m.directEmployeeCount,
      children: [],
    });
  }

  const roots: OrgChartNode[] = [];
  for (const m of managers) {
    const node = nodeById.get(m.id)!;
    if (m.reportsToId && nodeById.has(m.reportsToId) && m.reportsToId !== m.id) {
      nodeById.get(m.reportsToId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortTree = (nodes: OrgChartNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    nodes.forEach((n) => sortTree(n.children));
  };
  sortTree(roots);

  return roots;
}
