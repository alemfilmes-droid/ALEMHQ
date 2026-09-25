"use client";

import { Plus } from "lucide-react";
import { KanbanLane } from "@/components/kanban/kanban-lane";
import { Button } from "@/components/ui/button";
import { PautaCard } from "@/features/pautas/components/pauta-card";
import { PAUTA_COLUMN_LABELS } from "@/lib/pautas";
import { PAUTA_COLUMN_TONE } from "@/lib/status";
import type { PautaColumn, PautaWithDetails } from "@/types";

interface KanbanColumnProps {
  column: PautaColumn;
  pautas: PautaWithDetails[];
  onOpenPauta: (id: string) => void;
  onCreate?: () => void;
  canCreate: boolean;
}

/** Coluna do quadro de pautas por etapa — a casca (rolagem, droppable, cabeçalho) é o KanbanLane. */
export function KanbanColumn({ column, pautas, onOpenPauta, onCreate, canCreate }: KanbanColumnProps) {
  return (
    <KanbanLane
      id={column}
      label={PAUTA_COLUMN_LABELS[column]}
      tone={PAUTA_COLUMN_TONE[column]}
      count={pautas.length}
      emptyLabel="Nenhuma pauta aqui."
      action={
        canCreate ? (
          <Button variant="ghost" size="icon" className="size-7 shrink-0" onClick={onCreate} aria-label={`Nova pauta em ${PAUTA_COLUMN_LABELS[column]}`}>
            <Plus className="size-4" aria-hidden />
          </Button>
        ) : null
      }
    >
      {pautas.map((pauta) => (
        <PautaCard key={pauta.id} pauta={pauta} onOpen={() => onOpenPauta(pauta.id!)} />
      ))}
    </KanbanLane>
  );
}
