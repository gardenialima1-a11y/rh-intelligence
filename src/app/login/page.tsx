import { Suspense } from "react";
import { Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-navy-dark px-4"
      style={{
        backgroundImage:
          "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(184,147,90,0.16), transparent), radial-gradient(ellipse 60% 50% at 100% 100%, rgba(44,66,112,0.4), transparent)",
      }}
    >
      <div className="w-full max-w-[380px]">
        <div className="mb-8 flex flex-col items-center gap-3 text-cream">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold text-navy-dark shadow-[0_8px_24px_-6px_rgba(184,147,90,0.5)]">
            <Building2 className="h-6 w-6" strokeWidth={2.25} />
          </div>
          <h1 className="text-center text-[15px] font-semibold leading-snug tracking-tight text-cream/95">
            Plataforma de People Analytics
            <br />& RH BI
          </h1>
        </div>
        <Card className="border-white/10 bg-card shadow-[var(--shadow-popover)]">
          <CardHeader>
            <CardTitle className="text-base text-navy dark:text-cream">Acessar plataforma</CardTitle>
            <CardDescription>Entre com suas credenciais corporativas.</CardDescription>
          </CardHeader>
          <CardContent>
            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
