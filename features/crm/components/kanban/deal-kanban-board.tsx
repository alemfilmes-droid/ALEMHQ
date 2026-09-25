"use client";

import { useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { groupDealsByStage } from "@/features/crm/board";
import { useCrmFlow } from "@/features/crm/components/flow/crm-flow-provider";
import { DealCard } from "@/features/crm/components/kanban/deal-card";
import { DealColumn } from "@/features/crm/components/kanban/deal-column";
import { DEAL_STAGES } from "@/features/crm/labels";
import type { DealStage, DealWithDetails } from "@/types";

/**
 * O quadro é só um reflexo do banco: arrastar nunca move o card sozinho — abre o diálogo da etapa
 * (contato obrigatório, reunião, proposta...) e o card só muda de coluna quando o banco aceita.
 */
export function DealKanbanBoard({ deals }: { deals: DealWithDetails[] }) {
  const flow = useCrmFlow();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const board = groupDealsByStage(deals);
  const activeDeal = activeId ? deals.find((item) => item.id === activeId) : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const deal = deals.find((item) => item.id === String(active.id));
    if (!deal) return;
    flow.requestStage(deal, over.id as DealStage);
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid h-full min-h-0 flex-1 auto-cols-max grid-flow-col gap-4 overflow-x-auto pb-2 snap-x snap-mandatory">
        {DEAL_STAGES.map((stage) => (
          <DealColumn key={stage} stage={stage} deals={board[stage]} />
        ))}
      </div>
      <DragOverlay>{activeDeal ? <DealCard deal={activeDeal} dragging /> : null}</DragOverlay>
    </DndContext>
  );
}
