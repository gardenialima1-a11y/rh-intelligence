import { Users } from "lucide-react";
import type { OrgNode } from "@/services/organograma";
import { EditHierarchyButton } from "@/components/admin/edit-hierarchy-button";

function NodeCard({ node, allManagers }: { node: OrgNode; allManagers: { id: string; name: string }[] }) {
  const initials = node.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="group/card relative flex w-[190px] flex-col items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-3 text-center shadow-[var(--shadow-xs)] transition-shadow hover:shadow-[var(--shadow-sm)]">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-semibold text-gold">
        {initials}
      </div>
      <div className="flex flex-col">
        <span className="text-[13px] font-semibold leading-tight text-navy dark:text-cream">{node.name}</span>
        <span className="text-[11px] leading-tight text-muted-foreground">
          {node.area}
          {node.level ? ` · ${node.level}` : ""}
        </span>
      </div>
      <div className="flex items-center gap-1 rounded-full bg-gold/12 px-2 py-0.5 text-[11px] font-semibold text-gold-text">
        <Users className="h-3 w-3" />
        {node.directEmployeeCount} direto(s)
      </div>
      <div className="absolute right-1 top-1 opacity-0 transition-opacity group-hover/card:opacity-100">
        <EditHierarchyButton managerId={node.id} managers={allManagers} />
      </div>
    </div>
  );
}

export function OrgChartNode({
  node,
  allManagers,
  isRoot = false,
}: {
  node: OrgNode;
  allManagers: { id: string; name: string }[];
  isRoot?: boolean;
}) {
  const hasChildren = node.children.length > 0;

  return (
    <li className={"relative flex flex-col items-center px-2" + (isRoot ? "" : " pt-6 " +
      "before:absolute before:right-1/2 before:top-0 before:h-6 before:w-1/2 before:border-t-2 before:border-border " +
      "after:absolute after:left-1/2 after:top-0 after:h-6 after:w-1/2 after:border-l-2 after:border-t-2 after:border-border " +
      "first:before:border-t-0 first:after:rounded-tl-md " +
      "last:after:border-t-0 last:after:border-l-0 last:before:border-r-2 last:before:rounded-tr-md " +
      "only:before:hidden only:after:hidden only:pt-0"
    )}>
      <NodeCard node={node} allManagers={allManagers} />

      {hasChildren && (
        <ul className="relative flex before:absolute before:left-1/2 before:top-0 before:h-6 before:w-0 before:border-l-2 before:border-border">
          {node.children.map((child) => (
            <OrgChartNode key={child.id} node={child} allManagers={allManagers} />
          ))}
        </ul>
      )}
    </li>
  );
}
