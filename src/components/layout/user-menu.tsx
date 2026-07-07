"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOut, User as UserIcon, Settings } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABEL } from "@/lib/labels";

export function UserMenu({ name, email, role }: { name?: string | null; email?: string | null; role: string }) {
  const initials = (name ?? email ?? "U")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Abrir menu do usuário"
          className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Avatar>
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="font-medium">{name ?? "Usuário"}</span>
            <span className="text-xs font-normal text-muted-foreground">{email}</span>
            <span className="mt-1 w-fit rounded-full bg-gold/15 px-2 py-0.5 text-[10px] font-semibold text-gold-text">
              {ROLE_LABEL[role] ?? role}
            </span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/perfil">
            <UserIcon className="h-4 w-4" /> Meu perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/perfil">
            <Settings className="h-4 w-4" /> Preferências
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/login" })} className="text-danger">
          <LogOut className="h-4 w-4" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
