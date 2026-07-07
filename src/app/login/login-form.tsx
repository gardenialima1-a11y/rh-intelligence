"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { safeCallbackUrl } from "@/lib/url-safety";

const loginSchema = z.object({
  email: z.string().email("Informe um e-mail válido"),
  password: z.string().min(6, "A senha deve ter ao menos 6 caracteres"),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginValues) {
    setServerError(null);
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      });

      if (result?.error) {
        setServerError("E-mail ou senha inválidos.");
        return;
      }

      router.push(safeCallbackUrl(searchParams.get("callbackUrl")));
      router.refresh();
    } catch {
      setServerError("Não foi possível entrar agora. Tente novamente em instantes.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input id="email" type="email" placeholder="voce@empresa.com.br" {...register("email")} />
        {errors.email && <p className="text-xs text-danger">{errors.email.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Senha</Label>
        <Input id="password" type="password" placeholder="••••••••" {...register("password")} />
        {errors.password && <p className="text-xs text-danger">{errors.password.message}</p>}
      </div>

      {serverError && (
        <p className="rounded-lg border border-danger/20 bg-danger/8 px-3 py-2 text-[13px] text-danger">{serverError}</p>
      )}

      <Button type="submit" variant="gold" size="lg" disabled={loading} className="mt-1">
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Entrar
      </Button>

      <div className="mt-1 rounded-lg border border-border bg-muted/60 px-3 py-2.5 text-center text-[11.5px] leading-relaxed text-muted-foreground">
        Acesso via seed de demonstração
        <br />
        <span className="font-medium text-foreground/80">admin@gostomineiro.com.br</span> / <span className="font-medium text-foreground/80">senha123</span>
      </div>
    </form>
  );
}
