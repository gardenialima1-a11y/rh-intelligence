import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
 
export function formatNumber(value: number, opts: Intl.NumberFormatOptions = {}): string {
  return new Intl.NumberFormat("pt-BR", opts).format(value);
}
 
export function formatPercent(value: number, digits = 1): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}
 
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}
 
/**
 * Formata datas no padrão brasileiro (dd/mm/aaaa).
 *
 * Datas de calendário (admissão, nascimento, desligamento...) são gravadas
 * como meia-noite UTC (ex.: "2026-09-28" vira 2026-09-28T00:00:00Z).
 * Se exibíssemos no fuso de Fortaleza (UTC-3), elas "voltariam" um dia
 * (27/09). Por isso:
 *  - data exatamente à meia-noite UTC  -> exibida em UTC (dia digitado)
 *  - data com horário (createdAt etc.) -> exibida no fuso de Fortaleza
 * Usar sempre um fuso explícito também evita diferença entre servidor
 * (Vercel, em UTC) e navegador.
 */
const APP_TIME_ZONE = "America/Fortaleza";
 
function isCalendarDate(d: Date): boolean {
  return (
    d.getUTCHours() === 0 &&
    d.getUTCMinutes() === 0 &&
    d.getUTCSeconds() === 0 &&
    d.getUTCMilliseconds() === 0
  );
}
 
export function formatDate(date: Date | string, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "2-digit", year: "numeric" }): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  const timeZone = opts.timeZone ?? (isCalendarDate(d) ? "UTC" : APP_TIME_ZONE);
  return new Intl.DateTimeFormat("pt-BR", { ...opts, timeZone }).format(d);
}
 
