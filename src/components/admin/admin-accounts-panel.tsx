"use client";

import * as React from "react";
import { KeyRound, Copy, Check, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import { resetAdminPassword, type AdminAccount } from "@/actions/admin-users";

export function AdminAccountsPanel({ accounts }: { accounts: AdminAccount[] }) {
  const [confirmTarget, setConfirmTarget] = React.useState<AdminAccount | null>(null);
  const [loadingId, setLoadingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = React.useState(false);

  async function handleConfirmReset() {
    if (!confirmTarget) return;
    setLoadingId(confirmTarget.id);
    setError(null);
    const res = await resetAdminPassword(confirmTarget.id);
    setLoadingId(null);
    setConfirmTarget(null);
    if (res.success && res.temporaryPassword && res.email) {
      setResult({ email: res.email, password: res.temporaryPassword });
      setCopied(false);
    } else {
      setError(res.error ?? "Não foi possível redefinir a senha.");
    }
  }

  async function copyPassword() {
    if (!result) return;
    await navigator.clipboard.writeText(result.password);
    setCopied(true);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-4 w-4" /> Administradores da plataforma
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-[13px] text-muted-foreground">
          Apenas administradores podem ver esta lista. Ao redefinir uma senha, uma senha temporária
          segura é gerada e mostrada uma única vez — ela não fica salva em texto visível em nenhum
          lugar do sistema.
        </p>

        {error && (
          <p className="rounded-lg border border-danger/20 bg-danger/8 px-3 py-2 text-[13px] text-danger">{error}</p>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{a.name ?? "—"}</TableCell>
                <TableCell>{a.email}</TableCell>
                <TableCell>{formatDate(a.createdAt)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loadingId === a.id}
                    onClick={() => setConfirmTarget(a)}
                  >
                    {loadingId === a.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Redefinir senha
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      {/* Confirmação antes de redefinir — ação sensível e irreversível */}
      <Dialog open={!!confirmTarget} onOpenChange={(open) => !open && setConfirmTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-danger" /> Confirmar redefinição de senha
            </DialogTitle>
            <DialogDescription>
              A senha atual de <span className="font-medium text-foreground/80">{confirmTarget?.email}</span> será
              substituída por uma nova senha temporária gerada automaticamente. Essa pessoa precisará da nova senha
              para entrar novamente. Deseja continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button variant="gold" onClick={handleConfirmReset}>
              Sim, redefinir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resultado — a senha só aparece aqui, uma única vez */}
      <Dialog open={!!result} onOpenChange={(open) => !open && setResult(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Senha redefinida</DialogTitle>
            <DialogDescription>
              Copie e envie esta senha temporária com segurança para <span className="font-medium text-foreground/80">{result?.email}</span>.
              Ela só é exibida agora — depois de fechar esta janela, não será possível vê-la novamente.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/60 px-3 py-2.5">
            <code className="text-[13px] font-medium tracking-wide">{result?.password}</code>
            <Button variant="outline" size="sm" onClick={copyPassword}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
          <p className="text-[12px] text-muted-foreground">
            Recomende que a pessoa troque essa senha assim que possível, assim que essa funcionalidade estiver
            disponível no perfil do usuário.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="gold">Fechar</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
