import { Users, User } from "lucide-react";
import type { AreaOrgNode } from "@/services/organograma";
import { EditHierarchyButton } from "@/components/admin/edit-hierarchy-button";

function NodeCard({ node, allManagers }: { node: AreaOrgNode; allManagers: { id: string; name: string }[] }) {
  const initials = node.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      className={
        "group/card relative flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-center shadow-[var(--shadow-xs)] transition-shadow hover:shadow-[var(--shadow-sm)] " +
        (node.isManager ? "w-[190px] border-border bg-card" : "w-[160px] border-border/70 bg-muted/40")
      }
    >
      <div
        className={
          "flex shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold " +
          (node.isManager ? "h-10 w-10 bg-navy text-gold" : "h-8 w-8 bg-navy/10 text-navy dark:bg-cream/10 dark:text-cream")
        }
      >
        {node.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={node.photoUrl} alt={node.name} className="h-full w-full object-cover" />
        ) : node.isManager ? (
          initials
        ) : (
          <User className="h-4 w-4" />
        )}
      </div>
      <div className="flex flex-col">
        <span className={"leading-tight text-navy dark:text-cream " + (node.isManager ? "text-[13px] font-semibold" : "text-[12px] font-medium")}>
          {node.name}
        </span>
        {node.subtitle && <span className="text-[11px] leading-tight text-muted-foreground">{node.subtitle}</span>}
      </div>
      {node.isManager && (
        <div className="flex items-center gap-1 rounded-full bg-gold/12 px-2 py-0.5 text-[11px] font-semibold text-gold-text">
          <Users className="h-3 w-3" />
          {node.directCount} direto(s)
        </div>
      )}
      {node.isManager && (
        <div className="absolute right-1 top-1 opacity-0 transition-opacity group-hover/card:opacity-100">
          <EditHierarchyButton managerId={node.id} managers={allManagers} />
        </div>
      )}
    </div>
  );
}

export function AreaOrgChartNode({
  node,
  allManagers,
  isRoot = false,
}: {
  node: AreaOrgNode;
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
            <AreaOrgChartNode key={child.id} node={child} allManagers={allManagers} />
          ))}
        </ul>
      )}
    </li>
  );
}
