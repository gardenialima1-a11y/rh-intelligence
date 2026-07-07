import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL é obrigatório")
    .refine((v) => v.startsWith("postgresql://") || v.startsWith("postgres://"), {
      message: "DATABASE_URL deve ser uma connection string do PostgreSQL (postgresql://...)",
    }),
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET deve ter pelo menos 32 caracteres — gere um com: openssl rand -base64 32"),
  NEXTAUTH_URL: z.string().url().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).optional(),
});

export function validateEnv(rawEnv: Record<string, string | undefined>) {
  const parsed = envSchema.safeParse(rawEnv);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(
      `\n❌ Configuração de ambiente inválida. Verifique seu arquivo .env:\n${issues}\n\n` +
        `Copie .env.example para .env e preencha os valores corretamente.\n`
    );
  }
  return parsed.data;
}

// Em build-time (ex.: geração de tipos, lint) as variáveis reais podem não estar
// presentes; a validação estrita só é aplicada em runtime (dev/start), não durante `next build`.
export const env = process.env.SKIP_ENV_VALIDATION
  ? (process.env as unknown as ReturnType<typeof validateEnv>)
  : validateEnv(process.env);
