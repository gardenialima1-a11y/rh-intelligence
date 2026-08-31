import type { ReactNode } from "react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { FavoriteButton } from "@/components/dashboard/favorite-button";
import { isModuleFavorite } from "@/actions/favorites";

export async function ModuleHeader({
  title,
  description,
  moduleKey,
  actions,
}: {
  title: string;
  description: string;
  moduleKey?: string;
  /** Ações do módulo (ex.: botão de exportar relatório), exibidas ao lado do título. */
  actions?: ReactNode;
}) {
  const isFavorite = moduleKey ? await isModuleFavorite(moduleKey) : false;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Breadcrumb items={[{ label: title }]} />
        {moduleKey && <FavoriteButton moduleKey={moduleKey} initialIsFavorite={isFavorite} />}
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-navy dark:text-cream">{title}</h1>
          <p className="max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">{description}</p>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
