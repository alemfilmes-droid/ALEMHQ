import { findNavItem } from "@/lib/navigation";
import { PANEL_TONE, toneBorder, toneColor } from "@/lib/status";
import { cn } from "@/lib/utils";

/**
 * Ícone do painel, só no cabeçalho da página: o mesmo glifo da navegação, na cor do squad dono do
 * módulo (PANEL_TONE), dentro de um contêiner neutro com contorno levemente tingido — nunca fundo
 * colorido. A sidebar continua monocromática.
 */
export function PanelIcon({ href, className }: { href: string; className?: string }) {
  const item = findNavItem(href);
  if (!item) return null;
  const tone = PANEL_TONE[href] ?? "neutral";
  const Icon = item.icon;

  return (
    <span
      className={cn("flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-surface", className)}
      style={{ borderColor: toneBorder(tone) }}
    >
      <Icon className={cn("size-5", tone === "neutral" && "text-muted-foreground")} style={{ color: toneColor(tone) }} aria-hidden />
    </span>
  );
}
