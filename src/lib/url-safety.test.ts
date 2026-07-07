import { describe, it, expect } from "vitest";
import { safeCallbackUrl } from "@/lib/url-safety";

describe("safeCallbackUrl", () => {
  it("retorna '/' quando o valor é nulo ou vazio", () => {
    expect(safeCallbackUrl(null)).toBe("/");
    expect(safeCallbackUrl(undefined)).toBe("/");
    expect(safeCallbackUrl("")).toBe("/");
  });

  it("preserva caminhos relativos válidos", () => {
    expect(safeCallbackUrl("/modulos/turnover")).toBe("/modulos/turnover");
  });

  it("bloqueia URLs absolutas (open redirect)", () => {
    expect(safeCallbackUrl("https://site-malicioso.com")).toBe("/");
  });

  it("bloqueia URLs protocol-relative (open redirect)", () => {
    expect(safeCallbackUrl("//site-malicioso.com")).toBe("/");
  });

  it("bloqueia esquemas javascript:", () => {
    expect(safeCallbackUrl("javascript:alert(1)")).toBe("/");
  });
});
