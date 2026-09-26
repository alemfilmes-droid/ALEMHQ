"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { useSquadDirectory } from "@/components/providers/squad-directory";
import { SQUAD_LABELS } from "@/lib/auth/squads";
import { getInitials } from "@/lib/format";
import { primarySquad, squadColor } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { Squad } from "@/types";

interface UserAvatarProps {
  name: string;
  src?: string | null;
  className?: string;
  /** Id do profile: o squad principal vem do diretório carregado no layout. */
  profileId?: string | null;
  /** Squads conhecidos (ex.: o próprio usuário) — têm prioridade sobre o diretório. */
  squads?: readonly Squad[];
  /** Sem anel de squad (ex.: contatos de clientes, que não são da equipe). */
  plain?: boolean;
}

/**
 * Avatar de pessoa — o único componente para isso em todo o sistema. Foto, ou iniciais em cinza,
 * com um anel de 2px na cor do squad PRINCIPAL da pessoa (diretoria > comercial > audiovisual >
 * financeiro — ver primarySquad() em lib/theme). Sem squad conhecido, sem anel.
 */
function UserAvatar({ name, src, className, profileId, squads, plain = false }: UserAvatarProps) {
  const directory = useSquadDirectory();
  const squad = plain ? null : primarySquad(squads ?? (profileId ? directory[profileId] : undefined));
  const ring = squadColor(squad);

  return (
    <AvatarPrimitive.Root
      title={squad ? `${name} · ${SQUAD_LABELS[squad]}` : undefined}
      className={cn(
        "relative flex size-9 shrink-0 overflow-hidden rounded-full border border-border-strong bg-surface-hover",
        className,
      )}
      style={ring ? { boxShadow: `0 0 0 2px ${ring}`, borderColor: "var(--background)" } : undefined}
    >
      {src ? <AvatarPrimitive.Image src={src} alt="" className="aspect-square size-full object-cover" /> : null}
      <AvatarPrimitive.Fallback
        className="flex size-full items-center justify-center text-xs font-bold text-muted-foreground"
        delayMs={src ? 300 : 0}
      >
        {getInitials(name) || "—"}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}

/** Squad principal de uma pessoa pelo diretório (para barras e degradês de card). */
function usePrimarySquad(profileId: string | null | undefined): Squad | null {
  const directory = useSquadDirectory();
  return primarySquad(profileId ? directory[profileId] : undefined);
}

export { UserAvatar, usePrimarySquad };
