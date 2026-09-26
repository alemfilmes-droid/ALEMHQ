"use client";

import { Money } from "@/components/ui/money";
import { useDroppable } from "@dnd-kit/core";
import { StatusBar } from "@/components/ui/status-bar";
import { StatusDot } from "@/components/ui/status-dot";
import { useCrmFlow } from "@/features/crm/components/flow/crm-flow-provider";
import { DealCard } from "@/features/crm/components/kanban/deal-card";
import { summarizeStage } from "@/features/crm/board";
import { DEAL_STAGE_LABELS } from "@/features/crm/labels";
import { DEAL_STAGE_TONE } from "@/lib/status";
import { laneGlowStyle } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { DealStage, DealWithDetails } from "@/types";

interface DealColumnProps {
  stage: DealStage;
  deals: DealWithDetails[];
}

/** Uma das 10 colunas fixas do funil. O quadro rola na horizontal; cada coluna rola na vertical. */
export function DealColumn({ stage, deals }: DealColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const summary = summarizeStage(deals);
  const { canSeeFinance } = useCrmFlow();

  return (
    <div
      className="flex h-full min-h-0 w-64 shrink-0 snap-start flex-col overflow-hidden rounded-lg border border-border bg-surface sm:w-72"
      style={laneGlowStyle(DEAL_STAGE_TONE[stage])}
    >
      <div className="relative shrink-0 border-b border-border px-3 py-3">
        <StatusBar tone={DEAL_STAGE_TONE[stage]} side="top" />
        <div className="flex items-center gap-2">
          <StatusDot tone={DEAL_STAGE_TONE[stage]} />
          <span className="truncate text-sm font-bold">{DEAL_STAGE_LABELS[stage]}</span>
          <span className="shrink-0 text-xs font-semibold text-subtle">{summary.count}</span>
        </div>
        {canSeeFinance ? (
          <p className="mt-0.5 text-[12px] font-semibold text-muted-foreground">
            <Money cents={summary.totalValue} />
          </p>
        ) : null}
      </div>

      <div ref={setNodeRef} className={cn("min-h-0 flex-1 space-y-3 overflow-y-auto p-3", isOver && "bg-surface-hover")}>
        {deals.length === 0 ? (
          <p className="px-1 py-6 text-center text-[12px] text-subtle">Nenhum negócio aqui.</p>
        ) : (
          deals.map((deal) => <DealCard key={deal.id} deal={deal} />)
        )}
      </div>
    </div>
  );
}
