"use client";

import Link from "next/link";
import { LogOut, Settings, User } from "lucide-react";
import { signOutAction } from "@/app/(auth)/actions";
import { UserAvatar } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getFirstName } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/auth/roles";
import type { Profile } from "@/types";

export function UserMenu({ profile, canSeeSettings }: { profile: Profile; canSeeSettings: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-3 rounded-full py-1 pl-1 pr-1 transition-colors hover:bg-surface-hover sm:pr-3"
        aria-label="Menu do usuário"
      >
        <UserAvatar name={profile.full_name} src={profile.avatar_url} />
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-semibold leading-tight">{getFirstName(profile.full_name)}</span>
          {profile.job_title ? <span className="block text-[11px] leading-tight text-subtle">{profile.job_title}</span> : null}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <p className="truncate text-sm font-bold">{profile.full_name}</p>
          {profile.job_title ? <p className="truncate text-xs font-semibold text-muted-foreground">{profile.job_title}</p> : null}
          <p className="truncate text-xs font-normal text-muted-foreground">{profile.email}</p>
          <p className="mt-1 text-xs font-semibold text-subtle">{ROLE_LABELS[profile.access_role]}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/perfil">
            <User aria-hidden />
            Perfil
          </Link>
        </DropdownMenuItem>
        {canSeeSettings ? (
          <DropdownMenuItem asChild>
            <Link href="/configuracoes">
              <Settings aria-hidden />
              Configurações
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut aria-hidden />
              Sair
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
