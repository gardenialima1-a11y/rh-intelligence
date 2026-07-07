/**
 * Aceita apenas caminhos internos relativos (ex.: "/modulos/turnover"), nunca URLs
 * absolutas ou "protocol-relative" (ex.: "https://..." ou "//dominio-malicioso.com"),
 * evitando que um parâmetro de URL controlado pelo usuário (ex.: ?callbackUrl=) seja
 * usado para open-redirect.
 */
export function safeCallbackUrl(value: string | null | undefined): string {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
