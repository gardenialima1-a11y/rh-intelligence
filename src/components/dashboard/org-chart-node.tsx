import { Users } from "lucide-react";
import type { OrgNode } from "@/services/organograma";
import { cn } from "@/lib/utils";
import { EditHierarchyButton } from "@/components/admin/edit-hierarchy-button";

export function OrgChartNode({
  node,
  allManagers,
  isRoot = false,
}: {
  node: OrgNode;
  allManagers: { id: string; name: string }[];
  isRoot?: boolean;
}) {
  return (
    <div className={cn("flex flex-col", !isRoot && "ml-6 border-l border-border pl-6")}>
      <div className="my-1.5 flex w-fit items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5 shadow-[var(--shadow-xs)]">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy text-gold text-sm font-semibold">
          {node.name
            .split(" ")
            .map((p) => p[0])
            .slice(0, 2)
            .join("")
            .toUpperCase()}
        </div>
        <div className="flex flex-col">
          <span className="text-[13.5px] font-semibold text-navy dark:text-cream">{node.name}</span>
          <span className="text-xs text-muted-foreground">
            {node.area}
            {node.level ? ` · ${node.level}` : ""}
          </span>
        </div>
        <div className="ml-2 flex items-center gap-1 rounded-full bg-gold/12 px-2 py-0.5 text-[11px] font-semibold text-gold-text">
          <Users className="h-3 w-3" />
          {node.directEmployeeCount}
        </div>
        <EditHierarchyButton managerId={node.id} managers={allManagers} />
      </div>
      {node.children.length > 0 && (
        <div className="flex flex-col">
          {node.children.map((child) => (
            <OrgChartNode key={child.id} node={child} allManagers={allManagers} />
          ))}
        </div>
      )}
    </div>
  );
}
