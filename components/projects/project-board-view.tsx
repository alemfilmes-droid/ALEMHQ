"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { ProjectClientLabel } from "@/components/projects/project-client-label";
import { ProjectDates } from "@/components/projects/project-dates";
import { ProjectModelPill, ProjectStagePill } from "@/components/projects/project-pills";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { moveProjectOnBoardAction } from "@/features/projects/actions";
import { BOARD_COLUMNS, BOARD_COLUMN_LABELS, MIN_CHURN_REASON, boardColumnOf, checkMove, stageAfterMove, type BoardColumn } from "@/lib/projects/board";
import { PROJECT_STATUS_TINT } from "@/lib/projects/colors";
import { tintStyle, type Tint } from "@/lib/theme/tint";
import { cn } from "@/lib/utils";
import type { Project } from "@/types";

export type BoardProject = Pick<Project, "id" | "name" | "stage" | "model" | "due_date" | "start_date" | "end_date" | "is_internal"> & {
  stage_before_close?: Project["stage_before_close"];
  company: { id: string; name: string; logo_url: string | null } | null;
};

const COLUMN_TINT: Record<BoardColumn, Tint> = {
  ativos: PROJECT_STATUS_TINT.ativo,
  encerrados: PROJECT_STATUS_TINT.encerrado,
  churn: PROJECT_STATUS_TINT.churn,
};

const EMPTY: Record<BoardColumn, string> = {
  ativos: "Nenhum projeto ativo.",
  encerrados: "Nenhum projeto encerrado.",
  churn: "Nenhum projeto em churn.",
};

type Pending = { project: BoardProject; to: BoardColumn; kind: "needs_reason" | "needs_confirmation" };

/**
 * Quadro de Projetos: Ativos, Encerrados e Churn. Arraste o card (computador) ou use "Mover para" (celular e
 * teclado). Churn pede o motivo; Encerrar pede confirmação; tudo fica registrado (project_board_move).
 * No iPhone as colunas rolam na horizontal.
 */
export function ProjectBoardView({ projects, canMove }: { projects: BoardProject[]; canMove: boolean }) {
  const router = useRouter();
  const [items, setItems] = useState(projects);
  const [pending, setPending] = useState<Pending | null>(null);
  const [reason, setReason] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Dados novos do servidor (router.refresh) substituem o estado local.
  const [source, setSource] = useState(projects);
  if (source !== projects) {
    setSource(projects);
    setItems(projects);
  }

  function run(project: BoardProject, to: BoardColumn, extra: { reason?: string; confirmed?: boolean }) {
    const previous = items;
    setItems((current) => current.map((item) => (item.id === project.id ? { ...item, stage: stageAfterMove(to, item.stage_before_close ?? null) } : item)));
    setPending(null);
    setReason("");
    startTransition(async () => {
      const result = await moveProjectOnBoardAction({ projectId: project.id, to, ...extra });
      if (!result.ok) {
        setItems(previous);
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  function requestMove(project: BoardProject, to: BoardColumn) {
    const check = checkMove(project.stage, to);
    if (check.kind === "noop") return;
    if (check.kind === "ok") run(project, to, {});
    else setPending({ project, to, kind: check.kind });
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const project = items.find((item) => item.id === event.active.id);
    const to = event.over?.id as BoardColumn | undefined;
    if (project && to && (BOARD_COLUMNS as readonly string[]).includes(to)) requestMove(project, to);
  }

  const active = activeId ? items.find((item) => item.id === activeId) : null;

  return (
    <>
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="-mx-4 grid auto-cols-[86%] grid-flow-col gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] snap-x snap-mandatory sm:mx-0 sm:auto-cols-[60%] sm:px-0 lg:grid-flow-row lg:auto-cols-auto lg:grid-cols-3 lg:overflow-visible lg:snap-none">
          {BOARD_COLUMNS.map((column) => {
            const list = items.filter((item) => boardColumnOf(item.stage) === column);
            return (
              <BoardLane key={column} column={column} count={list.length}>
                {list.map((project) => (
                  <BoardCard key={project.id} project={project} canMove={canMove && !saving} onMove={(to) => requestMove(project, to)} hidden={project.id === activeId} />
                ))}
              </BoardLane>
            );
          })}
        </div>
        <DragOverlay>{active ? <CardBody project={active} dragging /> : null}</DragOverlay>
      </DndContext>

      <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          {pending?.kind === "needs_reason" ? (
            <>
              <DialogHeader>
                <DialogTitle>Mover para Churn.</DialogTitle>
                <DialogDescription>{pending.project.name}: o cliente saiu. Conte em poucas palavras o motivo — fica registrado com o seu nome e a data.</DialogDescription>
              </DialogHeader>
              <FormField id="churn-reason" label="Motivo do churn" hint={`Obrigatório (mínimo ${MIN_CHURN_REASON} caracteres).`}>
                <Textarea id="churn-reason" rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} />
              </FormField>
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setPending(null)}>
                  Cancelar
                </Button>
                <Button type="button" disabled={reason.trim().length < MIN_CHURN_REASON} onClick={() => run(pending.project, pending.to, { reason: reason.trim() })}>
                  Mover para Churn
                </Button>
              </DialogFooter>
            </>
          ) : pending ? (
            <>
              <DialogHeader>
                <DialogTitle>Encerrar projeto?</DialogTitle>
                <DialogDescription>
                  {pending.project.name} vai para Encerrados. Dá para voltar para Ativos depois (volta para a etapa em que estava). O movimento fica registrado.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setPending(null)}>
                  Cancelar
                </Button>
                <Button type="button" onClick={() => run(pending.project, pending.to, { confirmed: true })}>
                  Encerrar
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function BoardLane({ column, count, children }: { column: BoardColumn; count: number; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: column });
  const tint = COLUMN_TINT[column];
  return (
    <section
      aria-label={`${BOARD_COLUMN_LABELS[column]}: ${count}`}
      className="flex min-w-0 snap-start flex-col overflow-hidden rounded-lg border border-border bg-surface"
      style={{ borderColor: `color-mix(in srgb, ${tint.from} 30%, var(--border))` }}
    >
      <div className="relative shrink-0 border-b border-border px-3 py-3" style={{ backgroundImage: tintStyle(tint).backgroundImage }}>
        <span className="flex items-center gap-2">
          <span aria-hidden className="size-2 rounded-full" style={{ backgroundImage: `linear-gradient(135deg, ${tint.from}, ${tint.to})` }} />
          <span className="text-sm font-bold" style={{ color: tint.text }}>
            {BOARD_COLUMN_LABELS[column]}
          </span>
          <span className="text-xs font-semibold text-subtle">{count}</span>
        </span>
      </div>
      <div ref={setNodeRef} className={cn("min-h-40 flex-1 space-y-2.5 p-2.5 transition-colors", isOver && "bg-surface-hover")}>
        {count === 0 ? <p className="px-1 py-6 text-center text-[12px] text-subtle">{EMPTY[column]}</p> : children}
      </div>
    </section>
  );
}

function BoardCard({ project, canMove, onMove, hidden }: { project: BoardProject; canMove: boolean; onMove: (to: BoardColumn) => void; hidden: boolean }) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: project.id, disabled: !canMove });
  const current = boardColumnOf(project.stage);
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} className={cn("relative touch-pan-y", hidden && "opacity-40")}>
      <CardBody project={project} />
      {canMove ? (
        <div className="absolute right-1.5 top-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label={`Mover ${project.name}`}
                className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                onPointerDown={(event) => event.stopPropagation()}
              >
                <MoreHorizontal className="size-4" aria-hidden />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Mover para</DropdownMenuLabel>
              {BOARD_COLUMNS.filter((column) => column !== current).map((column) => (
                <DropdownMenuItem key={column} onSelect={() => onMove(column)}>
                  {BOARD_COLUMN_LABELS[column]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
    </div>
  );
}

function CardBody({ project, dragging = false }: { project: BoardProject; dragging?: boolean }) {
  return (
    <Link
      href={`/projetos/${project.id}`}
      draggable={false}
      className={cn("block rounded-md border border-border bg-card p-3 pr-11 transition-colors hover:border-border-strong", dragging && "shadow-2xl")}
    >
      <p className="text-sm font-bold leading-snug">{project.name}</p>
      <p className="mt-1.5 flex min-w-0 text-[12px] text-muted-foreground">
        <ProjectClientLabel isInternal={project.is_internal} company={project.company} withAvatar className="max-w-full" />
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <ProjectModelPill model={project.model} />
        <ProjectStagePill stage={project.stage} />
      </div>
      <p className="mt-2 text-[12px] text-muted-foreground">
        <ProjectDates project={project} />
      </p>
    </Link>
  );
}
