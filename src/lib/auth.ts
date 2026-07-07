import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/lib/auth.config";
import { SlidingWindowRateLimiter } from "@/lib/rate-limiter";

// Proteção contra força bruta: 5 tentativas falhas em 5 minutos bloqueiam o
// e-mail por 15 minutos. Em memória — adequado para uma única instância;
// em produção multi-instância, troque por um backend compartilhado (Redis).
const loginRateLimiter = new SlidingWindowRateLimiter(5, 5 * 60_000, 15 * 60_000);

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const rateLimitKey = email.toLowerCase();
        if (loginRateLimiter.isBlocked(rateLimitKey)) {
          const seconds = loginRateLimiter.secondsUntilUnblock(rateLimitKey);
          throw new Error(`Muitas tentativas. Tente novamente em ${Math.ceil(seconds / 60)} minuto(s).`);
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash) {
          loginRateLimiter.recordFailure(rateLimitKey);
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          loginRateLimiter.recordFailure(rateLimitKey);
          return null;
        }

        loginRateLimiter.reset(rateLimitKey);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          unitId: user.unitId,
        };
      },
    }),
  ],
});

