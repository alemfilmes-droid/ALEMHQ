import { findNavItem } from "@/lib/navigation";
import { PANEL_TONE, iconChipStyle } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * Ícone do painel, só no cabeçalho da página: o mesmo glifo da navegação, colorido pelo tom do
 * painel (PANEL_TONE em lib/theme), num contêiner tingido em baixa opacidade. A sidebar continua
 * monocromática.
 */
export function PanelIcon({ href, className }: { href: string; className?: string }) {
  const item = findNavItem(href);
  if (!item) return null;
  const tone = PANEL_TONE[href] ?? "neutral";
  const Icon = item.icon;

  return (
    <span
      className={cn("flex size-11 shrink-0 items-center justify-center rounded-lg border border-border bg-surface", className)}
      style={tone === "neutral" ? undefined : iconChipStyle(tone)}
    >
      <Icon className={cn("size-5", tone === "neutral" && "text-muted-foreground")} aria-hidden />
    </span>
  );
}
