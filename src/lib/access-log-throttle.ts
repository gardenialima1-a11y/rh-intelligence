// Evita registrar um acesso no banco a cada navegação do usuário.
//
// Antes, `(app)/layout.tsx` chamava `prisma.accessLog.create` em toda
// página aberta. Isso mantinha o compute do Neon sempre acordado (o
// autosuspend do plano free é de 5 minutos de inatividade) e consumia
// CU-hours/mês bem mais rápido do que o necessário, além de inflar a
// tabela accessLog sem ganho real de informação.
//
// Com o throttle abaixo, um mesmo usuário só gera uma nova escrita no
// banco a cada 5 minutos (mesmo que abra dezenas de páginas nesse
// intervalo) — o suficiente para saber que ele esteve ativo, sem impedir
// o banco de "dormir" entre sessões reais.
//
// É um cache em memória por instância do servidor (best-effort, assim
// como o próprio log de acesso já era): reinicia a cada cold start e não
// é compartilhado entre instâncias. Isso é aceitável aqui porque o
// objetivo é só reduzir volume, não garantir exatidão perfeita.

const THROTTLE_MS = 5 * 60_000; // alinhado ao auto-suspend do Neon free tier

const lastLoggedAt = new Map<string, number>();

export function shouldLogAccess(userId: string, now: number = Date.now()): boolean {
  const last = lastLoggedAt.get(userId);
  if (last !== undefined && now - last < THROTTLE_MS) {
    return false;
  }
  lastLoggedAt.set(userId, now);
  return true;
}
