"use client";

import * as React from "react";
import { Building2 } from "lucide-react";

/**
 * Espaço reservado da logomarca da empresa. Procura o arquivo em
 * /public/logo.png (é só colocar o arquivo lá, sem precisar mexer em código).
 * Enquanto não existir (ou se der erro ao carregar), mostra o ícone padrão no
 * lugar — nunca quebra a tela.
 */
export function CompanyLogo() {
  const [failed, setFailed] = React.useState(false);

  if (failed) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy text-gold shadow-[var(--shadow-xs)]">
        <Building2 className="h-4 w-4" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt="Logomarca da empresa"
      className="h-9 w-auto max-w-[120px] shrink-0 object-contain"
      onError={() => setFailed(true)}
    />
  );
}
