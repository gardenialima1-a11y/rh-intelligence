import { describe, it, expect } from "vitest";
import { SlidingWindowRateLimiter } from "@/lib/rate-limiter";

describe("SlidingWindowRateLimiter", () => {
  it("não bloqueia uma chave sem tentativas registradas", () => {
    const limiter = new SlidingWindowRateLimiter(5, 60_000, 60_000);
    expect(limiter.isBlocked("user@test.com")).toBe(false);
  });

  it("bloqueia após atingir o número máximo de tentativas na janela", () => {
    const limiter = new SlidingWindowRateLimiter(3, 60_000, 60_000);
    const now = 1_000_000;
    limiter.recordFailure("user@test.com", now);
    limiter.recordFailure("user@test.com", now + 100);
    expect(limiter.isBlocked("user@test.com", now + 200)).toBe(false);
    limiter.recordFailure("user@test.com", now + 200);
    expect(limiter.isBlocked("user@test.com", now + 300)).toBe(true);
  });

  it("desbloqueia automaticamente após o tempo de bloqueio expirar", () => {
    const limiter = new SlidingWindowRateLimiter(1, 60_000, 5_000);
    const now = 1_000_000;
    limiter.recordFailure("user@test.com", now);
    expect(limiter.isBlocked("user@test.com", now + 100)).toBe(true);
    expect(limiter.isBlocked("user@test.com", now + 5_001)).toBe(false);
  });

  it("reinicia a contagem quando a janela expira sem atingir o limite", () => {
    const limiter = new SlidingWindowRateLimiter(3, 1_000, 60_000);
    const now = 1_000_000;
    limiter.recordFailure("user@test.com", now);
    limiter.recordFailure("user@test.com", now + 2_000); // fora da janela de 1s -> reinicia
    expect(limiter.isBlocked("user@test.com", now + 2_100)).toBe(false);
  });

  it("reset() limpa o histórico de falhas", () => {
    const limiter = new SlidingWindowRateLimiter(1, 60_000, 60_000);
    limiter.recordFailure("user@test.com");
    limiter.reset("user@test.com");
    expect(limiter.isBlocked("user@test.com")).toBe(false);
  });

  it("secondsUntilUnblock retorna 0 quando não bloqueado e um valor positivo quando bloqueado", () => {
    const limiter = new SlidingWindowRateLimiter(1, 60_000, 10_000);
    const now = 1_000_000;
    expect(limiter.secondsUntilUnblock("user@test.com", now)).toBe(0);
    limiter.recordFailure("user@test.com", now);
    expect(limiter.secondsUntilUnblock("user@test.com", now + 1000)).toBe(9);
  });

  it("mantém chaves diferentes isoladas entre si", () => {
    const limiter = new SlidingWindowRateLimiter(1, 60_000, 60_000);
    limiter.recordFailure("a@test.com");
    expect(limiter.isBlocked("a@test.com")).toBe(true);
    expect(limiter.isBlocked("b@test.com")).toBe(false);
  });
});
