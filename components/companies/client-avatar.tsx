"use client";

import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ClientAvatarSize = "sm" | "md" | "lg";

const SIZE_CLASS: Record<ClientAvatarSize, string> = {
  sm: "size-6 rounded-[5px] text-[9px]",
  md: "size-9 rounded-md text-xs",
  lg: "size-16 rounded-lg text-lg",
};

interface ClientAvatarProps {
  name: string;
  logoUrl?: string | null;
  size?: ClientAvatarSize;
  className?: string;
}

/**
 * Logo do cliente — o único componente para isso (cards de clientes, projetos, pautas, CRM e
 * tabelas do financeiro). A imagem preenche o quadrado inteiro (object-cover, sem margem interna) —
 * logos quadrados ocupam todo o ícone; um logo muito retangular tem as bordas cortadas. Sem logo,
 * monograma com as iniciais em cinza; trabalho interno ("Além Filmes") mostra o acento vermelho da marca.
 */
/** Nome usado para trabalho interno (sem cliente): mostra o acento vermelho da marca em vez de "AF". */
export const INTERNAL_CLIENT_NAME = "Além Filmes";

export function ClientAvatar({ name, logoUrl, size = "md", className }: ClientAvatarProps) {
  if (!logoUrl && name === INTERNAL_CLIENT_NAME) {
    return (
      <span
        role="img"
        aria-label={INTERNAL_CLIENT_NAME}
        className={cn("relative flex shrink-0 items-center justify-center overflow-hidden border border-border-strong bg-[#0A0A0A]", SIZE_CLASS[size], className)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ícone estático da marca, alguns px */}
        <img src="/brand/simbolo_vermelho.png" alt="" className="w-[88%] object-contain" />
      </span>
    );
  }

  return (
    <AvatarPrimitive.Root
      className={cn("relative flex shrink-0 overflow-hidden border border-border-strong bg-surface-hover", SIZE_CLASS[size], className)}
    >
      {logoUrl ? <AvatarPrimitive.Image src={logoUrl} alt="" className="size-full object-cover" /> : null}
      <AvatarPrimitive.Fallback
        className="flex size-full items-center justify-center font-bold tracking-tight text-muted-foreground"
        delayMs={logoUrl ? 300 : 0}
      >
        {getInitials(name) || "—"}
      </AvatarPrimitive.Fallback>
    </AvatarPrimitive.Root>
  );
}
