import { Breadcrumb } from "@/components/layout/breadcrumb";
import { FavoriteButton } from "@/components/dashboard/favorite-button";
import { isModuleFavorite } from "@/actions/favorites";

export async function ModuleHeader({
  title,
  description,
  moduleKey,
}: {
  title: string;
  description: string;
  moduleKey?: string;
}) {
  const isFavorite = moduleKey ? await isModuleFavorite(moduleKey) : false;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Breadcrumb items={[{ label: title }]} />
        {moduleKey && <FavoriteButton moduleKey={moduleKey} initialIsFavorite={isFavorite} />}
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-navy dark:text-cream">{title}</h1>
      <p className="max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}
