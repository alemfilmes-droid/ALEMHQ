"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import { movePautaColumnAction } from "@/features/pautas/actions";
import { KanbanColumn } from "@/features/pautas/components/kanban-column";
import { PautaCreateDialog } from "@/features/pautas/components/pauta-create-dialog";
import { PautaCard } from "@/features/pautas/components/pauta-card";
import { PautaDetailModal } from "@/features/pautas/components/pauta-detail-modal";
import { PautaRemoveDialog, type PautaRemoval } from "@/features/pautas/components/pauta-remove-dialogs";
import { groupPautasByColumn } from "@/features/pautas/board";
import type { PautaFormOptions } from "@/features/pautas/types";
import { PAUTA_COLUMNS, defaultStatusForColumn } from "@/lib/pautas";
import type { PautaColumn, PautaWithDetails, Squad } from "@/types";

interface KanbanBoardProps {
  initialPautas: PautaWithDetails[];
  options: PautaFormOptions;
  /** Gestão plena (título, líder, prioridade, arrastar livre) — can_fully_manage_pauta(). */
  canManage: boolean;
  /** Criar pauta de projeto pelos "+" das colunas — can_manage_pautas() (master, diretoria, heads). */
  canCreate: boolean;
  /** Atalho "Criar projeto" no diálogo. */
  canCreateProjects: boolean;
  /** Fixa o projeto (aba Pautas do projeto) e some com o rótulo de cliente repetido nos cards. */
  lockedProjectId?: string;
  initialOpenId?: string;
  currentUser: { id: string; full_name: string; avatar_url: string | null; squads: Squad[]; managedSquads?: readonly Squad[] };
}

/** Permite que o botão "Nova pauta" da barra de ferramentas (fora deste componente) abra o diálogo. */
export interface KanbanBoardHandle {
  openCreate: (column?: PautaColumn) => void;
}

/** Quadro reaproveitado por /pautas e pela aba "Pautas" do projeto. A página não rola — só cada coluna. */
export const KanbanBoard = forwardRef<KanbanBoardHandle, KanbanBoardProps>(function KanbanBoard(
  { initialPautas, options, canManage, canCreate, canCreateProjects, lockedProjectId, initialOpenId, currentUser },
  ref,
) {
  const [pautas, setPautas] = useState(initialPautas);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(initialOpenId ?? null);
  const [createColumn, setCreateColumn] = useState<PautaColumn | null>(null);
  const [removal, setRemoval] = useState<PautaRemoval | null>(null);

  // Apagar: só quem criou (a policy do banco exige created_by = auth.uid()). Arquivar: gestão plena
  // ou quem criou — a diretoria arquiva o que não criou em vez de apagar.
  function menuFor(pauta: PautaWithDetails) {
    const isCreator = pauta.created_by === currentUser.id;
    return {
      canDelete: isCreator,
      canArchive: canManage || isCreator,
      onRemove: (mode: "delete" | "archive") => setRemoval({ mode, id: pauta.id!, title: pauta.title ?? "" }),
    };
  }

  function removeLocally(id: string) {
    setPautas((rows) => rows.filter((row) => row.id !== id));
    setOpenId((current) => (current === id ? null : current));
  }
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useImperativeHandle(ref, () => ({ openCreate: (column = "sprint_backlog") => setCreateColumn(column) }), []);

  const board = groupPautasByColumn(pautas);
  const activePauta = activeId ? pautas.find((item) => item.id === activeId) : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;
    const pautaId = String(active.id);
    const targetColumn = over.id as PautaColumn;
    const current = pautas.find((item) => item.id === pautaId);
    if (!current || current.board_column === targetColumn) return;

    const previous = pautas;
    setPautas((rows) =>
      rows.map((row) =>
        row.id === pautaId
          ? { ...row, board_column: targetColumn, status: defaultStatusForColumn(targetColumn, row.status ?? undefined) }
          : row,
      ),
    );

    void movePautaColumnAction({ id: pautaId, column: targetColumn }).then((result) => {
      if (!result.ok) {
        setPautas(previous);
        toast.error(result.error);
      }
    });
  }

  function handleCreated(pauta: PautaWithDetails) {
    setPautas((rows) => [pauta, ...rows]);
    setCreateColumn(null);
    setOpenId(pauta.id);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="grid h-full min-h-0 flex-1 auto-cols-[92%] grid-flow-col gap-4 overflow-x-auto pb-2 snap-x snap-mandatory sm:auto-cols-[60%] md:grid-flow-row md:auto-cols-auto md:grid-cols-4 md:overflow-visible md:snap-none md:pb-0">
          {PAUTA_COLUMNS.map((column) => (
            <KanbanColumn
              key={column}
              column={column}
              pautas={board[column]}
              onOpenPauta={setOpenId}
              canCreate={canCreate}
              onCreate={() => setCreateColumn(column)}
              menuFor={menuFor}
            />
          ))}
        </div>
        <DragOverlay>{activePauta ? <PautaCard pauta={activePauta} onOpen={() => {}} dragging /> : null}</DragOverlay>
      </DndContext>

      {createColumn ? (
        <PautaCreateDialog
          options={options}
          currentUser={{ id: currentUser.id, squads: currentUser.squads }}
          canCreateProjectPauta={canCreate}
          canCreateProjects={canCreateProjects}
          defaultColumn={createColumn}
          lockedProjectId={lockedProjectId}
          open
          onOpenChange={(next) => !next && setCreateColumn(null)}
          onCreated={handleCreated}
        />
      ) : null}

      {openId ? (
        <PautaDetailModal
          pautaId={openId}
          options={options}
          canManage={canManage}
          currentUser={currentUser}
          open
          onOpenChange={(next) => !next && setOpenId(null)}
          onChanged={(updated) => setPautas((rows) => rows.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)))}
          onRemoved={removeLocally}
        />
      ) : null}

      {removal ? <PautaRemoveDialog removal={removal} onOpenChange={(next) => !next && setRemoval(null)} onDone={removeLocally} /> : null}
    </div>
  );
});
