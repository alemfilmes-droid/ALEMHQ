"use client";

import { useState, type CSSProperties } from "react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import { KanbanLane } from "@/components/kanban/kanban-lane";
import { laneKeyOf, lanesFor, priorityRank, type KanbanDimension } from "@/features/minhas-pautas/board";
import { PautaCard, type PautaCardMenu } from "@/features/pautas/components/pauta-card";
import { movePautaColumnAction, updatePautaAction } from "@/features/pautas/actions";
import { PAUTA_COLUMNS, defaultStatusForColumn } from "@/lib/pautas";
import { PRIORITIES } from "@/lib/domain";
import type { PautaColumn, PautaWithDetails, ProjectPriority, Squad } from "@/types";

interface MyPautasKanbanProps {
  pautas: PautaWithDetails[];
  dimension: KanbanDimension;
  mySquads: readonly Squad[];
  currentUserId: string;
  /** Gestão plena de pautas (can_fully_manage_pauta) — pode mudar a prioridade de qualquer pauta. */
  canManage: boolean;
  onOpen: (id: string) => void;
  onChanged: (pauta: PautaWithDetails) => void;
  /** Menu do card (arquivar / apagar para quem criou). */
  menuFor?: (pauta: PautaWithDetails) => PautaCardMenu | undefined;
}

const BLOCKED_SQUAD = "Pautas não mudam de squad pelo quadro — cada uma pertence ao squad que a criou.";
const BLOCKED_PRIORITY = "Só a gestão de pautas muda a prioridade desta pauta.";

function isPriority(value: string): value is ProjectPriority {
  return (PRIORITIES as readonly string[]).includes(value);
}

function isColumn(value: string): value is PautaColumn {
  return (PAUTA_COLUMNS as readonly string[]).includes(value);
}

/**
 * Quadro pessoal agrupado por squad, prioridade ou status. Colunas fixas preenchendo a largura, cada
 * uma rolando por dentro. Arrastar só muda o que a pessoa pode mudar: prioridade (gestão ou dono da
 * tarefa avulsa) ou status (quem edita a pauta — o banco confere de novo). Entre squads, nunca.
 */
export function MyPautasKanban({ pautas, dimension, mySquads, currentUserId, canManage, onOpen, onChanged, menuFor }: MyPautasKanbanProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const lanes = lanesFor(dimension, pautas, mySquads);
  const activePauta = activeId ? (pautas.find((pauta) => pauta.id === activeId) ?? null) : null;
  const activeLane = activePauta ? laneKeyOf(activePauta, dimension) : null;

  function canChangePriority(pauta: PautaWithDetails) {
    return canManage || (pauta.is_standalone === true && pauta.created_for === currentUserId);
  }

  /** Coluna em que soltar o card ativo não é permitido (para avisar durante o arrasto). */
  function isBlocked(laneKey: string): boolean {
    if (!activePauta || laneKey === activeLane) return false;
    if (dimension === "squad") return true;
    if (dimension === "prioridade") return !canChangePriority(activePauta);
    return false;
  }

  function sortedIn(laneKey: string) {
    return pautas
      .filter((pauta) => laneKeyOf(pauta, dimension) === laneKey)
      .sort(
        (a, b) =>
          (a.due_date ?? "9999-99-99").localeCompare(b.due_date ?? "9999-99-99") || priorityRank(a.priority) - priorityRank(b.priority),
      );
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const pauta = pautas.find((item) => item.id === String(event.active.id));
    const target = event.over ? String(event.over.id) : null;
    if (!pauta?.id || !target || target === laneKeyOf(pauta, dimension)) return;

    if (dimension === "squad") {
      toast.error(BLOCKED_SQUAD);
      return;
    }

    if (dimension === "prioridade" && isPriority(target)) {
      if (!canChangePriority(pauta)) {
        toast.error(BLOCKED_PRIORITY);
        return;
      }
      const previous = pauta;
      onChanged({ ...pauta, priority: target });
      void updatePautaAction(pauta.id, { priority: target }).then((result) => {
        if (!result.ok) {
          onChanged(previous);
          toast.error(result.error);
        }
      });
      return;
    }

    if (dimension === "status" && isColumn(target)) {
      const previous = pauta;
      onChanged({ ...pauta, board_column: target, status: defaultStatusForColumn(target, pauta.status ?? undefined) });
      void movePautaColumnAction({ id: pauta.id, column: target }).then((result) => {
        if (!result.ok) {
          onChanged(previous);
          toast.error(result.error);
        }
      });
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveId(null)}>
      <div
        className="grid h-[calc(100dvh-15rem)] min-h-[520px] auto-cols-[88%] grid-flow-col gap-4 overflow-x-auto pb-2 snap-x snap-mandatory sm:auto-cols-[46%] md:grid-flow-row md:auto-cols-auto md:overflow-visible md:snap-none md:pb-0 md:[grid-template-columns:repeat(var(--lanes),minmax(0,1fr))]"
        style={{ "--lanes": lanes.length } as CSSProperties}
      >
        {lanes.map((lane) => {
          const items = sortedIn(lane.key);
          const blocked = isBlocked(lane.key);
          return (
            <KanbanLane
              key={lane.key}
              id={lane.key}
              label={lane.label}
              tone={lane.tone}
              count={items.length}
              emptyLabel="Nada aqui."
              blocked={blocked}
              blockedLabel={dimension === "squad" ? "Não muda de squad" : "Sem permissão para mudar"}
            >
              {items.map((pauta) => (
                <PautaCard key={pauta.id} pauta={pauta} onOpen={() => onOpen(pauta.id!)} menu={menuFor?.(pauta)} />
              ))}
            </KanbanLane>
          );
        })}
      </div>
      <DragOverlay>
        {activePauta ? (
          <PautaCard pauta={activePauta} onOpen={() => {}} dragging />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
