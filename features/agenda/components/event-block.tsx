"use client";

import type { CSSProperties } from "react";
import { Lock, Repeat } from "lucide-react";
import { StatusBar } from "@/components/ui/status-bar";
import { eventTimeLabel } from "@/features/agenda/layout";
import type { AgendaEvent } from "@/features/agenda/types";
import { COMMITMENT_KIND_LABELS } from "@/features/crm/labels";
import { timeInAppZone } from "@/lib/calendar";
import { COMMITMENT_KIND_TONE } from "@/lib/status";
import { cn } from "@/lib/utils";

function describe(event: AgendaEvent): string {
  if (event.busyOnly) return `Ocupado — ${event.ownerName}, ${eventTimeLabel(event)}`;
  return `${event.title}, ${eventTimeLabel(event)}, ${COMMITMENT_KIND_LABELS[event.kind]}${event.source === "pauta" ? ", pauta" : ""}`;
}

interface EventBlockProps {
  event: AgendaEvent;
  onOpen: (event: AgendaEvent) => void;
  style?: CSSProperties;
  /** Bloco curto (menos de ~40 min): uma linha só. */
  compact?: boolean;
  className?: string;
}

/**
 * Bloco de evento no calendário: fundo neutro, cor só na barra de 3px à esquerda (tipo do
 * compromisso). Privado de outra pessoa: "Ocupado", tracejado e sem abrir detalhes.
 */
export function EventBlock({ event, onOpen, style, compact = false, className }: EventBlockProps) {
  const busy = event.busyOnly;

  return (
    <button
      type="button"
      style={style}
      onClick={busy ? undefined : () => onOpen(event)}
      aria-disabled={busy || undefined}
      aria-label={describe(event)}
      title={describe(event)}
      className={cn(
        "group relative flex w-full min-w-0 flex-col overflow-hidden rounded-md border py-1 pl-2.5 pr-1.5 text-left text-[12px] leading-tight transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
        busy
          ? "cursor-default border-dashed border-border-strong bg-surface text-subtle"
          : "border-border-strong bg-surface-raised hover:bg-surface-hover",
        compact && "flex-row items-center gap-1.5",
        className,
      )}
    >
      <StatusBar tone={busy ? "neutral" : COMMITMENT_KIND_TONE[event.kind]} side="left" />
      <span className={cn("flex min-w-0 items-center gap-1 font-semibold", busy ? "text-subtle" : "text-foreground", compact && "shrink")}>
        {busy ? <Lock className="size-3 shrink-0" aria-hidden /> : null}
        {event.recurrenceRule && !busy ? <Repeat className="size-3 shrink-0 text-subtle" aria-hidden /> : null}
        <span className="truncate">{busy ? "Ocupado" : event.title}</span>
      </span>
      <span className={cn("truncate tabular-nums text-subtle", compact && "shrink-0")}>{eventTimeLabel(event)}</span>
      {!compact && !busy && (event.companyName || event.source === "pauta") ? (
        <span className="truncate text-subtle">{event.source === "pauta" ? `Pauta${event.companyName ? ` · ${event.companyName}` : ""}` : event.companyName}</span>
      ) : null}
    </button>
  );
}

/** Linha compacta (visão de mês e lista): barra do tipo + horário + título. */
export function EventChip({ event, onOpen }: { event: AgendaEvent; onOpen: (event: AgendaEvent) => void }) {
  const busy = event.busyOnly;
  return (
    <button
      type="button"
      onClick={busy ? undefined : () => onOpen(event)}
      aria-disabled={busy || undefined}
      title={describe(event)}
      className={cn(
        "relative flex w-full min-w-0 items-center gap-1.5 overflow-hidden rounded-sm py-0.5 pl-2 pr-1 text-left text-[11px] leading-tight",
        busy ? "cursor-default text-subtle" : "hover:bg-surface-hover",
      )}
    >
      <StatusBar tone={busy ? "neutral" : COMMITMENT_KIND_TONE[event.kind]} side="left" />
      {!event.allDay ? <span className="shrink-0 tabular-nums text-subtle">{timeInAppZone(event.startsAt)}</span> : null}
      <span className={cn("truncate font-semibold", !busy && "text-foreground")}>{busy ? "Ocupado" : event.title}</span>
    </button>
  );
}
