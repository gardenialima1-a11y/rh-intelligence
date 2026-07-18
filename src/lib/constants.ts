/**
 * Constantes compartilhadas entre Server e Client Components. Este arquivo
 * NÃO importa nada do Prisma/servidor de propósito, para poder ser
 * importado com segurança em componentes "use client".
 */
export const MAIN_AREAS = ["Administrativo", "Comercial", "Logística", "Produção"] as const;
export type MainArea = (typeof MAIN_AREAS)[number];
