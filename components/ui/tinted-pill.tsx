import type { ReactNode } from "react";
import { tintStyle, type Tint } from "@/lib/theme/tint";
import { cn } from "@/lib/utils";

/** Pílula em degradê suave (lib/theme/tint). Para status/modelos com cor; o resto continua no Badge. */
export function TintedPill({ tint, children, className }: { tint: Tint; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold [&_svg]:size-3", className)} style={tintStyle(tint)}>
      {children}
    </span>
  );
}
