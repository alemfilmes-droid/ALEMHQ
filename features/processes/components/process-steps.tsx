"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Archive, ArchiveRestore, CheckCircle2, Clock, ExternalLink, GripVertical, Pencil, Play, Plus, Target, User } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { RichText } from "@/components/ui/rich-text";
import { SearchSelect } from "@/components/ui/search-select";
import {
  discardRunAction,
  finishRunAction,
  reorderStepsAction,
  setStepArchivedAction,
  startRunAction,
  toggleRunStepAction,
} from "@/features/processes/actions";
import { DriveFolderTool, type DriveProjectOption } from "@/features/processes/components/drive-folder-tool";
import { StepFormDialog } from "@/features/processes/components/step-form-dialog";
import { stepHref, SYSTEM_AREA_LABELS, type ProcessDetail, type ProcessRunItem, type ProcessStepItem } from "@/features/processes/types";
import { formatDateTime } from "@/lib/format";
import { squadColor } from "@/lib/theme";
import { cn } from "@/lib/utils";

const NO_PROJECT = "__sem_projeto__";

interface ProcessStepsProps {
  process: ProcessDetail;
  canEdit: boolean;
  openRun: ProcessRunItem | null;
  projects: DriveProjectOption[];
}

/**
 * Passo a passo do processo. Ler não exige nada; "Iniciar execução" liga as caixas de marcação
 * (quem marcou e quando ficam registrados). A liderança do squad edita, reordena e arquiva passos.
 */
export function ProcessSteps({ process, canEdit, openRun, projects }: ProcessStepsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [stepDialog, setStepDialog] = useState<ProcessStepItem | "new" | null>(null);
  const [starting, setStarting] = useState(false);
  const active = useMemo(() => process.steps.filter((step) => !step.archived), [process.steps]);
  const archived = process.steps.filter((step) => step.archived);
  const [order, setOrder] = useState(active);
  const [done, setDone] = useState<Set<string>>(new Set(openRun?.done.map((item) => item.stepId)));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => setOrder(active), [active]);
  useEffect(() => setDone(new Set(openRun?.done.map((item) => item.stepId))), [openRun]);

  const total = active.length;
  const doneCount = active.filter((step) => done.has(step.id)).length;
  const percent = total > 0 ? Math.round((doneCount * 100) / total) : 0;
  const missingBlocking = active.filter((step) => step.isBlocking && !done.has(step.id));
  const doneInfo = new Map(openRun?.done.map((item) => [item.stepId, item]) ?? []);
  const color = squadColor(process.squad) ?? "var(--foreground)";
  const contextProjectId = openRun?.contextEntityType === "project" ? openRun.contextEntityId : null;

  function toggle(step: ProcessStepItem, checked: boolean) {
    if (!openRun) return;
    setDone((current) => {
      const next = new Set(current);
      if (checked) next.add(step.id);
      else next.delete(step.id);
      return next;
    });
    startTransition(async () => {
      const result = await toggleRunStepAction(openRun.id, step.id, checked);
      if (!result.ok) {
        toast.error(result.error);
        setDone((current) => {
          const next = new Set(current);
          if (checked) next.delete(step.id);
          else next.add(step.id);
          return next;
        });
      } else router.refresh();
    });
  }

  function finish() {
    if (!openRun) return;
    if (missingBlocking.length > 0 && !window.confirm(`Ainda há ${missingBlocking.length} passo(s) obrigatório(s) sem marcar. Concluir mesmo assim?`)) return;
    startTransition(async () => {
      const result = await finishRunAction(openRun.id, process.slug);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  function discard() {
    if (!openRun || !window.confirm("Descartar esta execução? As marcações somem.")) return;
    startTransition(async () => {
      const result = await discardRunAction(openRun.id, process.slug);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const { active: dragged, over } = event;
    if (!over || dragged.id === over.id) return;
    const from = order.findIndex((step) => step.id === dragged.id);
    const to = order.findIndex((step) => step.id === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(order, from, to);
    setOrder(next);
    startTransition(async () => {
      const result = await reorderStepsAction(
        process.id,
        next.map((step) => step.id),
      );
      if (!result.ok) {
        toast.error(result.error);
        setOrder(active);
      }
    });
  }

  function setArchived(step: ProcessStepItem, value: boolean) {
    startTransition(async () => {
      const result = await setStepArchivedAction(process.id, step.id, value);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
    });
  }

  const list = editing ? order : active;

  return (
    <div className="space-y-5">
      {/* Execução: barra de progresso e ações, ou o convite para iniciar. */}
      {/* Fixa no topo só durante a execução (no celular, ler não pode perder espaço). */}
      <div className={cn("rounded-lg border border-border bg-background/95 p-3 sm:p-4", openRun && "sticky top-16 z-10 backdrop-blur")}>
        {openRun ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold">
                Execução em andamento · {doneCount} de {total}
                <span className="ml-2 font-normal text-muted-foreground">
                  desde {formatDateTime(openRun.startedAt)}
                  {openRun.contextLabel ? ` · ${openRun.contextLabel}` : ""}
                </span>
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={discard} disabled={pending}>
                  Descartar
                </Button>
                <Button size="sm" onClick={finish} loading={pending}>
                  <CheckCircle2 aria-hidden />
                  Concluir execução
                </Button>
              </div>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-hover" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Progresso da execução">
              <span className="block h-full rounded-full transition-[width]" style={{ width: `${percent}%`, background: color }} />
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-muted-foreground">Leia à vontade. Para registrar quem fez cada passo e quando, inicie uma execução.</p>
            <div className="flex flex-wrap gap-2">
              {canEdit ? (
                <Button size="sm" variant={editing ? "primary" : "secondary"} onClick={() => setEditing((value) => !value)}>
                  <Pencil aria-hidden />
                  {editing ? "Concluir edição" : "Editar passos"}
                </Button>
              ) : null}
              <Button size="sm" onClick={() => setStarting(true)} disabled={total === 0 || editing}>
                <Play aria-hidden />
                Iniciar execução
              </Button>
            </div>
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border-strong px-6 py-10 text-center text-sm text-muted-foreground">
          Este fluxograma ainda não tem passos.{canEdit ? " Use “Editar passos” para adicionar." : ""}
        </p>
      ) : editing ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order.map((step) => step.id)} strategy={verticalListSortingStrategy}>
            <ol className="space-y-3">
              {order.map((step, index) => (
                <SortableStep key={step.id} step={step} index={index} onEdit={() => setStepDialog(step)} onArchive={() => setArchived(step, true)} pending={pending} />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      ) : (
        <ol className="space-y-3">
          {list.map((step, index) => {
            const info = doneInfo.get(step.id);
            const checked = done.has(step.id);
            return (
              <li key={step.id} id={`passo-${index + 1}`} className="scroll-mt-40">
                <StepCard step={step} index={index} color={color} checked={checked}>
                  {openRun ? (
                    <label className="flex shrink-0 cursor-pointer items-center gap-2 text-[12px] text-muted-foreground">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => toggle(step, value === true)}
                        aria-label={`Marcar passo ${index + 1} como feito`}
                        className="size-6"
                      />
                      <span className="hidden sm:inline">{checked ? "Feito" : "Marcar"}</span>
                    </label>
                  ) : null}
                  {info ? (
                    <p className="text-[12px] text-subtle">
                      Feito por {info.doneByName ?? "—"} em {formatDateTime(info.doneAt)}
                    </p>
                  ) : null}
                  {step.tool === "pasta_drive" ? <DriveFolderTool projects={projects} initialProjectId={contextProjectId} /> : null}
                </StepCard>
              </li>
            );
          })}
        </ol>
      )}

      {editing ? (
        <div className="space-y-4">
          <Button type="button" variant="secondary" onClick={() => setStepDialog("new")}>
            <Plus aria-hidden />
            Adicionar passo
          </Button>
          {archived.length > 0 ? (
            <div className="space-y-2">
              <p className="eyebrow">Passos arquivados</p>
              <ul className="space-y-2">
                {archived.map((step) => (
                  <li key={step.id} className="flex items-center justify-between gap-3 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                    <span className="truncate">{step.title}</span>
                    <Button size="sm" variant="ghost" onClick={() => setArchived(step, false)} disabled={pending}>
                      <ArchiveRestore aria-hidden />
                      Reativar
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {stepDialog ? <StepFormDialog processId={process.id} step={stepDialog === "new" ? undefined : stepDialog} onOpenChange={(next) => !next && setStepDialog(null)} /> : null}
      {starting ? <StartRunDialog processId={process.id} projects={projects} onOpenChange={setStarting} /> : null}
    </div>
  );
}

function StepMeta({ step }: { step: ProcessStepItem }) {
  const target = stepHref(step);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {step.isBlocking ? <Badge variant="outline">Obrigatório</Badge> : null}
      {step.responsibleRole ? (
        <Badge variant="muted">
          <User aria-hidden />
          {step.responsibleRole}
        </Badge>
      ) : null}
      {step.estimatedMinutes ? (
        <Badge variant="muted">
          <Clock aria-hidden />~{step.estimatedMinutes} min
        </Badge>
      ) : null}
      {target ? (
        target.external ? (
          <a href={target.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-border-strong px-2.5 py-0.5 text-xs font-semibold hover:bg-surface-hover">
            <ExternalLink className="size-3" aria-hidden />
            {SYSTEM_AREA_LABELS[step.systemArea]}
          </a>
        ) : (
          <Link href={target.href} className="inline-flex items-center gap-1 rounded-full border border-border-strong px-2.5 py-0.5 text-xs font-semibold hover:bg-surface-hover">
            Abrir {SYSTEM_AREA_LABELS[step.systemArea] === "Fora do sistema" ? "no sistema" : SYSTEM_AREA_LABELS[step.systemArea]}
          </Link>
        )
      ) : step.systemArea !== "nenhum" ? (
        <Badge variant="muted">{SYSTEM_AREA_LABELS[step.systemArea]}</Badge>
      ) : null}
    </div>
  );
}

function StepCard({ step, index, color, checked = false, children }: { step: ProcessStepItem; index: number; color: string; checked?: boolean; children?: React.ReactNode }) {
  return (
    <article className={cn("relative space-y-3 rounded-lg border border-border bg-card p-4 transition-opacity", checked && "opacity-70")}>
      <div className="flex items-start gap-3">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-black tabular-nums"
          style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color, border: `1px solid color-mix(in srgb, ${color} 45%, transparent)` }}
        >
          {index + 1}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <h3 className={cn("font-bold leading-snug", checked && "line-through decoration-1")}>{step.title}</h3>
          <StepMeta step={step} />
        </div>
      </div>
      {step.description ? <RichText source={step.description} className="pl-11" /> : null}
      {step.doneCriteria ? (
        <p className="ml-11 flex items-start gap-2 rounded-md border border-border bg-surface-raised px-3 py-2 text-[13px]">
          <Target className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            <span className="font-semibold">Pronto quando: </span>
            <span className="text-muted-foreground">{step.doneCriteria}</span>
          </span>
        </p>
      ) : null}
      {children ? <div className="ml-11 flex flex-col gap-2">{children}</div> : null}
    </article>
  );
}

function SortableStep({ step, index, onEdit, onArchive, pending }: { step: ProcessStepItem; index: number; onEdit: () => void; onArchive: () => void; pending: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex items-center gap-2 rounded-lg border border-border bg-card p-3", isDragging && "relative z-10 shadow-lg")}
    >
      <button type="button" {...attributes} {...listeners} className="cursor-grab rounded-sm p-1 text-subtle hover:text-foreground active:cursor-grabbing" aria-label={`Arrastar o passo ${step.title}`}>
        <GripVertical className="size-4" aria-hidden />
      </button>
      <span className="w-6 text-right text-sm font-black tabular-nums text-subtle">{index + 1}</span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{step.title}</span>
      <Button size="sm" variant="ghost" onClick={onEdit} disabled={pending}>
        <Pencil aria-hidden />
        <span className="sr-only sm:not-sr-only">Editar</span>
      </Button>
      <Button size="sm" variant="ghost" onClick={onArchive} disabled={pending}>
        <Archive aria-hidden />
        <span className="sr-only sm:not-sr-only">Arquivar</span>
      </Button>
    </li>
  );
}

function StartRunDialog({ processId, projects, onOpenChange }: { processId: string; projects: DriveProjectOption[]; onOpenChange: (open: boolean) => void }) {
  const [projectId, setProjectId] = useState(NO_PROJECT);
  const [pending, startTransition] = useTransition();

  function start() {
    const project = projects.find((item) => item.id === projectId);
    startTransition(async () => {
      const result = await startRunAction(processId, project ? { projectId: project.id, label: `${project.name} · ${project.clientName}` } : null);
      if (result.ok) {
        toast.success(result.message);
        onOpenChange(false);
      } else toast.error(result.error);
    });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Iniciar execução.</DialogTitle>
          <DialogDescription>As caixas de cada passo passam a registrar quem fez e quando. Ao concluir, vai para o histórico.</DialogDescription>
        </DialogHeader>
        <FormField id="run-project" label="Projeto (opcional)" hint="Para saber depois a que esta execução se refere.">
          <SearchSelect
            id="run-project"
            value={projectId}
            onChange={setProjectId}
            options={[{ value: NO_PROJECT, label: "Sem projeto" }, ...projects.map((item) => ({ value: item.id, label: `${item.name} · ${item.clientName}` }))]}
            placeholder="Escolha"
          />
        </FormField>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={start} loading={pending}>
            <Play aria-hidden />
            Iniciar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

