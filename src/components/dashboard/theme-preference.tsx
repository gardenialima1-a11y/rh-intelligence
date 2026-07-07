"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Escuro", icon: Moon },
  { value: "system", label: "Automático", icon: Monitor },
] as const;

export function ThemePreference() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- padrão recomendado do next-themes para evitar mismatch de hidratação
  React.useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-10 w-full" />;

  return (
    <div className="flex gap-2">
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const isActive = theme === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => setTheme(opt.value)}
            className={cn(
              "flex flex-1 flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-xs font-medium transition-colors",
              isActive ? "border-gold bg-gold/10 text-gold-text" : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            <Icon className="h-4 w-4" />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
