"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Archive,
  ArchiveRestore,
  CheckCircle2,
  ChevronDown,
  Clock,
  ExternalLink,
  GripVertical,
  Lightbulb,
  OctagonAlert,
  Pencil,
  Play,
  Plus,
  Printer,
  Smartphone,
  Target,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RichText } from "@/components/ui/rich-text";
import {
  discardRunAction,
  finishRunAction,
  reorderStepsAction,
  setStepArchivedAction,
  toggleRunStepAction,
} from "@/features/processes/actions";
import { type DriveProjectOption } from "@/features/processes/components/drive-folder-tool";
import { ProcessFlowchart } from "@/features/processes/components/process-flowchart";
import { StartRunDialog, StepTools } from "@/features/processes/components/step-shared";
import { StepFormDialog } from "@/features/processes/components/step-form-dialog";
import type { InvoiceReceivableOption } from "@/features/processes/components/invoice-file-tool";
import { ACTION_ICONS } from "@/features/processes/icons";
import { isInsideHq, stepHref, STEP_TYPE_LABELS, SYSTEM_AREA_LABELS, type ProcessDetail, type ProcessRunItem, type ProcessStepItem } from "@/features/processes/types";
import { formatDateTime } from "@/lib/format";
import { toneColor } from "@/lib/status";
import { ACCENT, squadColor } from "@/lib/theme";
import { cn } from "@/lib/utils";

interface ProcessStepsProps {
  process: ProcessDetail;
  canEdit: boolean;
  openRun: ProcessRunItem | null;
  projects: DriveProjectOption[];
  receivables: InvoiceReceivableOption[];
}

/**
 * Fluxograma + passo a passo. Clicar num nó abre o detalhe do passo abaixo. Ler não exige nada;
 * "Iniciar execução" liga as caixas (quem marcou e quando ficam registrados). Na impressão, tudo
 * aparece aberto. A liderança do squad edita, reordena e arquiva passos.
 */
export function ProcessSteps({ process, canEdit, openRun, projects, receivables }: ProcessStepsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [stepDialog, setStepDialog] = useState<ProcessStepItem | "new" | null>(null);
  const [starting, setStarting] = useState(false);
  const active = useMemo(() => process.steps.filter((step) => !step.archived), [process.steps]);
  const archived = process.steps.filter((step) => step.archived);
  const [order, setOrder] = useState(active);
  const [done, setDone] = useState<Set<string>>(new Set(openRun?.done.map((item) => item.stepId)));
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [focused, setFocused] = useState<string | null>(null);
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
  const allOpen = expanded.size === total && total > 0;

  function select(stepId: string) {
    setExpanded((current) => new Set(current).add(stepId));
    setFocused(stepId);
    window.requestAnimationFrame(() => document.getElementById(`passo-${stepId}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function toggleExpanded(stepId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  }

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

  return (
    <div className="space-y-6">
      {/* Execução: barra de progresso e ações, ou os atalhos de leitura. */}
      <div className={cn("rounded-lg border border-border bg-background/95 p-3 print:hidden sm:p-4", openRun && "sticky top-16 z-10 backdrop-blur")}>
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
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" asChild>
                  <Link href={`/fluxogramas/${process.slug}?modo=execucao`}>
                    <Smartphone aria-hidden />
                    Modo execução
                  </Link>
                </Button>
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
              <Button size="sm" variant="ghost" onClick={() => window.print()}>
                <Printer aria-hidden />
                Imprimir / PDF
              </Button>
              {canEdit ? (
                <Button size="sm" variant={editing ? "primary" : "secondary"} onClick={() => setEditing((value) => !value)}>
                  <Pencil aria-hidden />
                  {editing ? "Concluir edição" : "Editar passos"}
                </Button>
              ) : null}
              <Button size="sm" variant="secondary" asChild>
                <Link href={`/fluxogramas/${process.slug}?modo=execucao`}>
                  <Smartphone aria-hidden />
                  Modo execução
                </Link>
              </Button>
              <Button size="sm" onClick={() => setStarting(true)} disabled={total === 0 || editing}>
                <Play aria-hidden />
                Iniciar execução
              </Button>
            </div>
          </div>
        )}
      </div>

      {total === 0 ? (
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
        <>
          <section aria-label="Fluxograma" className="rounded-lg border border-border bg-surface-raised p-4 print:border-none print:p-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="eyebrow">Fluxograma · clique num passo para abrir</p>
              <Legend />
            </div>
            <ProcessFlowchart steps={active} squad={process.squad} done={openRun ? done : undefined} activeId={focused} onSelect={select} />
          </section>

          <div className="flex items-center justify-between gap-2 print:hidden">
            <h2 className="section-title">Passo a passo</h2>
            <Button size="sm" variant="ghost" onClick={() => setExpanded(allOpen ? new Set() : new Set(active.map((step) => step.id)))}>
              {allOpen ? "Fechar todos" : "Abrir todos"}
            </Button>
          </div>

          <ol className="space-y-3">
            {active.map((step, index) => {
              const info = doneInfo.get(step.id);
              const checked = done.has(step.id);
              return (
                <li key={step.id} id={`passo-${step.id}`} className="scroll-mt-40 break-inside-avoid">
                  <StepCard
                    step={step}
                    index={index}
                    steps={active}
                    color={color}
                    checked={checked}
                    open={expanded.has(step.id)}
                    onToggle={() => toggleExpanded(step.id)}
                    onJump={select}
                    action={
                      openRun ? (
                        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-[12px] text-muted-foreground print:hidden">
                          <Checkbox checked={checked} onCheckedChange={(value) => toggle(step, value === true)} aria-label={`Marcar passo ${index + 1} como feito`} className="size-6" />
                          <span className="hidden sm:inline">{checked ? "Feito" : "Marcar"}</span>
                        </label>
                      ) : null
                    }
                  >
                    {info ? (
                      <p className="text-[12px] text-subtle">
                        Feito por {info.doneByName ?? "—"} em {formatDateTime(info.doneAt)}
                      </p>
                    ) : null}
                    <StepTools step={step} projects={projects} receivables={receivables} contextProjectId={contextProjectId} />
                  </StepCard>
                </li>
              );
            })}
          </ol>
        </>
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

      {stepDialog ? (
        <StepFormDialog
          processId={process.id}
          step={stepDialog === "new" ? undefined : stepDialog}
          steps={active}
          onOpenChange={(next) => !next && setStepDialog(null)}
        />
      ) : null}
      {starting ? <StartRunDialog processId={process.id} projects={projects} onOpenChange={setStarting} /> : null}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-sm border" style={{ borderColor: `color-mix(in srgb, ${ACCENT} 55%, var(--border))` }} aria-hidden />
        No HQ
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-sm border border-dashed border-border-strong" aria-hidden />
        Fora do HQ
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2.5 rotate-45 rounded-[2px] border border-foreground/60" aria-hidden />
        Decisão
      </span>
    </div>
  );
}

function StepMeta({ step }: { step: ProcessStepItem }) {
  const target = stepHref(step);
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {step.stepType !== "acao" ? <Badge variant="outline">{STEP_TYPE_LABELS[step.stepType]}</Badge> : null}
      {step.isBlocking ? (
        <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold" style={{ color: toneColor("warning"), borderColor: toneColor("warning") }}>
          <OctagonAlert className="size-3" aria-hidden />
          Não avance sem concluir
        </span>
      ) : null}
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
          <a href={target.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-dashed border-border-strong px-2.5 py-0.5 text-xs font-semibold hover:bg-surface-hover">
            <ExternalLink className="size-3" aria-hidden />
            Abrir {SYSTEM_AREA_LABELS[step.systemArea] === "Sistema externo" ? "o sistema externo" : SYSTEM_AREA_LABELS[step.systemArea]}
          </a>
        ) : (
          <Link
            href={target.href}
            className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold hover:bg-surface-hover"
            style={{ borderColor: `color-mix(in srgb, ${ACCENT} 50%, var(--border))` }}
          >
            {target.href.startsWith("/fluxogramas/") ? "Ver o fluxograma de referência" : `Abrir ${SYSTEM_AREA_LABELS[step.systemArea] === "Fora do sistema" ? "no HQ" : `${SYSTEM_AREA_LABELS[step.systemArea]} no HQ`}`}
          </Link>
        )
      ) : step.systemArea !== "nenhum" ? (
        <Badge variant="muted">{SYSTEM_AREA_LABELS[step.systemArea]}</Badge>
      ) : null}
    </div>
  );
}

/** Detalhe do passo: descrição, imagem, exemplo, critério de pronto e saídas (decisão). */
export function StepBody({ step, steps, onJump }: { step: ProcessStepItem; steps: ProcessStepItem[]; onJump?: (stepId: string) => void }) {
  const yes = steps.findIndex((item) => item.id === step.branchYesStepId);
  const no = steps.findIndex((item) => item.id === step.branchNoStepId);
  return (
    <div className="space-y-3">
      {step.description ? <RichText source={step.description} /> : null}
      {step.stepType === "decisao" && (yes >= 0 || no >= 0) ? (
        <div className="flex flex-wrap gap-2 text-[13px]">
          {[
            { label: "Sim", index: yes, tone: "success" as const },
            { label: "Não", index: no, tone: "danger" as const },
          ]
            .filter((branch) => branch.index >= 0)
            .map((branch) => (
              <button
                key={branch.label}
                type="button"
                onClick={() => onJump?.(steps[branch.index]!.id)}
                className="rounded-md border border-border px-3 py-1.5 text-left hover:bg-surface-hover"
              >
                <span className="font-bold" style={{ color: toneColor(branch.tone) }}>
                  {branch.label}
                </span>{" "}
                → passo {branch.index + 1}: {steps[branch.index]!.title}
              </button>
            ))}
        </div>
      ) : null}
      {step.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- imagem ilustrativa enviada pela liderança
        <img src={step.imageUrl} alt={`Ilustração: ${step.title}`} className="max-h-80 w-auto max-w-full rounded-md border border-border object-contain" />
      ) : null}
      {step.exampleText ? (
        <div className="rounded-md border border-border bg-surface-raised p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold text-muted-foreground">
            <Lightbulb className="size-3.5" aria-hidden />
            Exemplo
          </p>
          <pre className="whitespace-pre-wrap break-words font-mono text-[12.5px] text-foreground">{step.exampleText}</pre>
        </div>
      ) : null}
      {step.doneCriteria ? (
        <p className="flex items-start gap-2 rounded-md border border-border bg-surface-raised px-3 py-2 text-[13px]">
          <Target className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            <span className="font-semibold">Pronto quando: </span>
            <span className="text-muted-foreground">{step.doneCriteria}</span>
          </span>
        </p>
      ) : null}
    </div>
  );
}

function StepCard({
  step,
  index,
  steps,
  color,
  checked,
  open,
  onToggle,
  onJump,
  action,
  children,
}: {
  step: ProcessStepItem;
  index: number;
  steps: ProcessStepItem[];
  color: string;
  checked: boolean;
  open: boolean;
  onToggle: () => void;
  onJump: (stepId: string) => void;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const Icon = ACTION_ICONS[step.actionKind];
  const inside = isInsideHq(step);
  return (
    <article
      className={cn("relative rounded-lg border bg-card transition-opacity", step.systemArea === "externo" ? "border-dashed border-border-strong" : "border-border", checked && "opacity-70")}
      style={inside ? { borderColor: `color-mix(in srgb, ${ACCENT} 35%, var(--border))` } : undefined}
    >
      <div className="flex items-start gap-3 p-4">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-black tabular-nums"
          style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color, border: `1px solid color-mix(in srgb, ${color} 45%, transparent)` }}
        >
          {index + 1}
        </span>
        <button type="button" onClick={onToggle} aria-expanded={open} className="min-w-0 flex-1 space-y-2 text-left">
          <h3 className={cn("flex items-start gap-2 font-bold leading-snug", checked && "line-through decoration-1")}>
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0 flex-1">{step.title}</span>
            <ChevronDown className={cn("mt-0.5 size-4 shrink-0 text-subtle transition-transform print:hidden", open && "rotate-180")} aria-hidden />
          </h3>
        </button>
        {action}
      </div>
      <div className="-mt-2 px-4 pb-3 pl-[3.75rem]">
        <StepMeta step={step} />
      </div>
      <div className={cn("space-y-3 border-t border-border px-4 py-3 pl-[3.75rem]", open ? "block" : "hidden print:block")}>
        <StepBody step={step} steps={steps} onJump={onJump} />
        {children}
      </div>
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
      {step.stepType !== "acao" ? <Badge variant="outline">{STEP_TYPE_LABELS[step.stepType]}</Badge> : null}
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
