"use client";

import { useRef } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard, type KanbanBoardHandle } from "@/features/pautas/components/kanban-board";
import { PautasFilters } from "@/features/pautas/components/pautas-filters";
import type { PautaFormOptions } from "@/features/pautas/types";
import type { PautaWithDetails } from "@/types";

interface PautasBoardProps {
  initialPautas: PautaWithDetails[];
  options: PautaFormOptions;
  companies: { id: string; name: string }[];
  canManage: boolean;
  defaultOwnerId: string;
  initialOpenId?: string;
  currentUser: { id: string; full_name: string; avatar_url: string | null };
}

/**
 * Página /pautas: junta a barra de filtros + busca + "Nova pauta" ao quadro num único
 * client boundary, para o botão abrir o diálogo que vive dentro do KanbanBoard (mesmo
 * estado otimista da lista) sem precisar duplicar a lógica de criação aqui.
 */
export function PautasBoard({ initialPautas, options, companies, canManage, defaultOwnerId, initialOpenId, currentUser }: PautasBoardProps) {
  const boardRef = useRef<KanbanBoardHandle>(null);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="mb-4 flex shrink-0 flex-wrap items-center justify-between gap-3">
        <PautasFilters options={options} companies={companies} />
        {canManage ? (
          <Button className="shrink-0" onClick={() => boardRef.current?.openCreate()}>
            <Plus aria-hidden />
            Nova pauta
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1">
        <KanbanBoard
          ref={boardRef}
          initialPautas={initialPautas}
          options={options}
          canManage={canManage}
          defaultOwnerId={defaultOwnerId}
          initialOpenId={initialOpenId}
          currentUser={currentUser}
        />
      </div>
    </div>
  );
}
