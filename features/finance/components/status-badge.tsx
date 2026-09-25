import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Ban, CheckCircle2, Clock, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/features/finance/labels";
import type { PayableStatus, ReceivableStatus } from "@/features/finance/types";
import { toneColor, type StatusTone } from "@/lib/status";
import { cn } from "@/lib/utils";

type Status = ReceivableStatus | PayableStatus;

const ICONS: Record<Status, LucideIcon> = {
  pendente: Clock,
  atrasado: AlertTriangle,
  recebido: CheckCircle2,
  pago: CheckCircle2,
  cancelado: Ban,
};

/** Cor por status: recebido/pago = sucesso, pendente = atenção, atrasado = crítico, cancelado = neutro. */
const STATUS_TONE: Record<Status, StatusTone> = {
  pendente: "warning",
  atrasado: "danger",
  recebido: "success",
  pago: "success",
  cancelado: "neutral",
};

/**
 * Contorno neutro (nunca fundo colorido) com ícone e texto na cor semântica do status —
 * cor como sinal, não decoração. "Cancelado" fica cinza (sem tom semântico).
 */
export function StatusBadge({ status }: { status: Status }) {
  const Icon = ICONS[status];
  const color = toneColor(STATUS_TONE[status]);
  return (
    <Badge
      variant={status === "cancelado" ? "muted" : "outline"}
      className={cn(status === "atrasado" && "font-bold")}
      style={color ? { borderColor: color, color } : undefined}
    >
      <Icon aria-hidden />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function DirectionIcon({ direction, className }: { direction: "in" | "out"; className?: string }) {
  const Icon = direction === "in" ? ArrowDownLeft : ArrowUpRight;
  return (
    <span
      className={cn("inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border-strong", className)}
      title={direction === "in" ? "Entrada" : "Saída"}
    >
      <Icon className="size-3.5" aria-hidden />
      <span className="sr-only">{direction === "in" ? "Entrada" : "Saída"}</span>
    </span>
  );
}
