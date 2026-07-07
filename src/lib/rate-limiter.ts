interface Attempt {
  count: number;
  firstAttemptAt: number;
  blockedUntil: number | null;
}

/**
 * Rate limiter de janela deslizante em memória. Adequado para uma única
 * instância de servidor; em deployments multi-instância (múltiplos pods/
 * containers), substitua o `store` por um backend compartilhado (ex.: Redis)
 * mantendo a mesma interface pública.
 */
export class SlidingWindowRateLimiter {
  private store = new Map<string, Attempt>();

  constructor(
    private readonly maxAttempts: number,
    private readonly windowMs: number,
    private readonly blockMs: number
  ) {}

  /** Retorna true se a chave (ex.: e-mail, IP) está bloqueada no momento. */
  isBlocked(key: string, now: number = Date.now()): boolean {
    const attempt = this.store.get(key);
    if (!attempt?.blockedUntil) return false;
    if (now >= attempt.blockedUntil) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  /** Registra uma tentativa falha. Bloqueia a chave se exceder o limite na janela. */
  recordFailure(key: string, now: number = Date.now()): void {
    const attempt = this.store.get(key);
    const isNewWindow = !attempt || now - attempt.firstAttemptAt > this.windowMs;

    const count = isNewWindow ? 1 : attempt.count + 1;
    const firstAttemptAt = isNewWindow ? now : attempt.firstAttemptAt;
    const blockedUntil = count >= this.maxAttempts ? now + this.blockMs : null;

    this.store.set(key, { count, firstAttemptAt, blockedUntil });
  }

  /** Limpa o histórico de falhas da chave (chamar após login bem-sucedido). */
  reset(key: string): void {
    this.store.delete(key);
  }

  /** Segundos restantes até o desbloqueio (0 se não estiver bloqueado). */
  secondsUntilUnblock(key: string, now: number = Date.now()): number {
    const attempt = this.store.get(key);
    if (!attempt?.blockedUntil) return 0;
    return Math.max(0, Math.ceil((attempt.blockedUntil - now) / 1000));
  }
}
