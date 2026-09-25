"use client";

import * as React from "react";
import * as AvatarPrimitive from "@radix-ui/react-avatar";
import { cn } from "@/lib/utils";
import { getInitials } from "@/lib/format";

interface UserAvatarProps {
  name: string;
  src?: string | null;
  className?: string;
}

/** Avatar do usuário: foto, ou iniciais em tons de cinza. */
function UserAvatar({ name, src, className }: UserAvatarProps) {
  return (
    <AvatarPrimitive.Root
      className={cn(
        "relative flex size-9 shrink-0 overflow-hidden rounded-full border border-border-strong bg-surface-hover",
        className,
      )}
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

export { UserAvatar };
