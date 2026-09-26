"use client";

import type { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Ban } from "lucide-react";
import { StatusBar } from "@/components/ui/status-bar";
import { StatusDot } from "@/components/ui/status-dot";
import type { StatusTone } from "@/lib/status";
import { laneGlowStyle } from "@/lib/theme";
import { cn } from "@/lib/utils";

interface KanbanLaneProps {
  /** Id do droppable (@dnd-kit) — a chave da coluna. */
  id: string;
  label: string;
  tone: StatusTone;
  count: number;
  children: ReactNode;
  emptyLabel?: string;
  /** Botão no cabeçalho (ex.: "+ nova pauta"). */
  action?: ReactNode;
  /** Durante um arrasto: soltar aqui não é permitido (a coluna avisa, em vez de só ignorar). */
  blocked?: boolean;
  blockedLabel?: string;
}

/**
 * Coluna de quadro reaproveitada pelos quadros de pautas (/pautas, aba do projeto e Minhas Pautas).
 * Regra de layout: a página não rola — só o corpo da coluna rola, com altura própria (min-h-0 na
 * cadeia flex é o que faz isso funcionar). A cor do status aparece no ponto, na barra de 3px do topo
 * e numa borda/brilho suave da coluna (laneGlowStyle).
 */
export function KanbanLane({ id, label, tone, count, children, emptyLabel = "Nada aqui.", action, blocked = false, blockedLabel }: KanbanLaneProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 shrink-0 snap-start flex-col overflow-hidden rounded-lg border border-border bg-surface"
      style={laneGlowStyle(tone)}
    >
      <div className="relative shrink-0 border-b border-border px-3 py-3">
        <StatusBar tone={tone} side="top" />
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-2">
            <StatusDot tone={tone} />
            <span className="truncate text-sm font-bold">{label}</span>
            <span className="shrink-0 text-xs font-semibold text-subtle">{count}</span>
          </span>
          {action}
        </div>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "relative min-h-0 flex-1 space-y-3 overflow-y-auto p-3 transition-colors",
          isOver && !blocked && "bg-surface-hover",
          blocked && "bg-background/40",
        )}
      >
        {blocked ? (
          <p className="sticky top-0 z-10 flex items-center justify-center gap-1.5 rounded-md border border-dashed border-border-strong bg-surface px-2 py-2 text-center text-[12px] font-semibold text-muted-foreground">
            <Ban className="size-3.5 shrink-0" aria-hidden />
            {blockedLabel ?? "Não é possível soltar aqui."}
          </p>
        ) : null}
        {count === 0 ? <p className="px-1 py-6 text-center text-[12px] text-subtle">{emptyLabel}</p> : children}
      </div>
    </div>
  );
}
