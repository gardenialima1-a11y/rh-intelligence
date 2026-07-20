"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden flex items-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-medium text-cream shadow-[var(--shadow-xs)] transition-opacity hover:opacity-90 dark:bg-gold dark:text-navy-dark"
    >
      <Printer className="h-4 w-4" /> Imprimir / Salvar como PDF
    </button>
  );
}
