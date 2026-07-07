import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [], // provedores completos (com acesso ao Prisma) só existem em src/lib/auth.ts (runtime Node.js)
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role;
        token.unitId = user.unitId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.unitId = token.unitId;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
