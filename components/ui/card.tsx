import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { SURFACE, iconChipStyle, type PanelTone } from "@/lib/theme";
import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** "static": sem brilho no hover (formulários). Padrão: card de painel/lista, com brilho. */
  variant?: "surface" | "static";
}

/** Card do sistema: gradiente de grafite, borda fina e brilho vermelho suave no hover (ver lib/theme). */
const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, variant = "surface", ...props }, ref) => (
  <div
    ref={ref}
    className={cn("rounded-lg text-card-foreground", variant === "static" ? SURFACE.cardStatic : SURFACE.card, className)}
    {...props}
  />
));
Card.displayName = "Card";

function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1.5 p-6", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("section-title", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6 pt-0", className)} {...props} />;
}

/** Ícone representativo de um card: contêiner pequeno e arredondado, tingido pelo acento (ou pelo tom). */
function CardIcon({ icon: Icon, tone = "accent", className }: { icon: LucideIcon; tone?: PanelTone; className?: string }) {
  return (
    <span className={cn(SURFACE.iconChip, className)} style={iconChipStyle(tone)}>
      <Icon aria-hidden />
    </span>
  );
}

/** Cabeçalho padrão dos cards de painel: ícone tingido + título + ação opcional à direita. */
function CardHeading({ icon, tone = "accent", title, action, className }: { icon: LucideIcon; tone?: PanelTone; title: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 p-6 pb-4", className)}>
      <CardIcon icon={icon} tone={tone} />
      <h3 className="min-w-0 flex-1 truncate text-sm font-bold text-muted-foreground">{title}</h3>
      {action}
    </div>
  );
}

/** Classe do card clicável da home (o card inteiro é o link): superfície + brilho + foco visível. */
const CARD_LINK_CLASS = cn(SURFACE.card, "flex h-full flex-col rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring");

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardIcon, CardHeading, CARD_LINK_CLASS };
