export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { env } = await import("@/lib/env");
    console.log(`✓ Ambiente validado — conectando a ${new URL(env.DATABASE_URL).hostname}`);
  }
}
