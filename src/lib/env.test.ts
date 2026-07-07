import { describe, it, expect } from "vitest";
import { validateEnv } from "@/lib/env";

const VALID_ENV = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  AUTH_SECRET: "a".repeat(32),
};

describe("validateEnv", () => {
  it("aceita uma configuração válida", () => {
    expect(() => validateEnv(VALID_ENV)).not.toThrow();
  });

  it("rejeita DATABASE_URL ausente", () => {
    expect(() => validateEnv({ ...VALID_ENV, DATABASE_URL: "" })).toThrow(/DATABASE_URL/);
  });

  it("rejeita DATABASE_URL que não é PostgreSQL", () => {
    expect(() => validateEnv({ ...VALID_ENV, DATABASE_URL: "mysql://localhost/db" })).toThrow(/PostgreSQL/);
  });

  it("rejeita AUTH_SECRET curto demais", () => {
    expect(() => validateEnv({ ...VALID_ENV, AUTH_SECRET: "curto" })).toThrow(/32 caracteres/);
  });

  it("aceita NEXTAUTH_URL opcional quando ausente", () => {
    expect(() => validateEnv(VALID_ENV)).not.toThrow();
  });

  it("rejeita NEXTAUTH_URL malformada quando presente", () => {
    expect(() => validateEnv({ ...VALID_ENV, NEXTAUTH_URL: "not-a-url" })).toThrow();
  });
});
