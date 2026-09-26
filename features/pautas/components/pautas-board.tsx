"use client";

import { useRef } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KanbanBoard, type KanbanBoardHandle } from "@/features/pautas/components/kanban-board";
import { PautasFilters } from "@/features/pautas/components/pautas-filters";
import type { PautaFormOptions } from "@/features/pautas/types";
import type { PautaWithDetails, Squad } from "@/types";

interface PautasBoardProps {
  initialPautas: PautaWithDetails[];
  options: PautaFormOptions;
  companies: { id: string; name: string }[];
  canManage: boolean;
  /** Criar pauta de projeto (master, diretoria, heads). */
  canCreate: boolean;
  canCreateProjects: boolean;
  initialOpenId?: string;
  currentUser: { id: string; full_name: string; avatar_url: string | null; squads: Squad[] };
  /** Assinatura dos filtros da URL: quando muda, o quadro remonta com a lista nova do servidor. */
  filtersKey: string;
}

/**
 * Página /pautas: junta a barra de filtros + busca + "Nova pauta" ao quadro num único
 * client boundary, para o botão abrir o diálogo que vive dentro do KanbanBoard (mesmo
 * estado otimista da lista) sem precisar duplicar a lógica de criação aqui.
 */
export function PautasBoard({ initialPautas, options, companies, canManage, canCreate, canCreateProjects, initialOpenId, currentUser, filtersKey }: PautasBoardProps) {
  const boardRef = useRef<KanbanBoardHandle>(null);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="mb-4 flex shrink-0 flex-wrap items-start justify-between gap-3">
        <PautasFilters options={options} companies={companies} />
        {canCreate ? (
          <Button className="shrink-0" onClick={() => boardRef.current?.openCreate()}>
            <Plus aria-hidden />
            Nova pauta
          </Button>
        ) : null}
      </div>

      <div className="min-h-0 flex-1">
        {/*
          O quadro guarda a lista em estado local (arrasto otimista). Sem a key, um filtro novo trazia
          a lista filtrada do servidor mas o quadro continuava mostrando a lista antiga — era o bug
          de "Prioridade: Média devolve tudo". A key remonta o quadro a cada combinação de filtros.
        */}
        <KanbanBoard
          key={filtersKey}
          ref={boardRef}
          initialPautas={initialPautas}
          options={options}
          canManage={canManage}
          canCreate={canCreate}
          canCreateProjects={canCreateProjects}
          initialOpenId={initialOpenId}
          currentUser={currentUser}
        />
      </div>
    </div>
  );
}
