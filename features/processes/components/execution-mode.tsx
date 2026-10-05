"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, ExternalLink, OctagonAlert, Play, User, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { finishRunAction, toggleRunStepAction } from "@/features/processes/actions";
import { type DriveProjectOption } from "@/features/processes/components/drive-folder-tool";
import type { InvoiceReceivableOption } from "@/features/processes/components/invoice-file-tool";
import { StepBody } from "@/features/processes/components/process-steps";
import { StartRunDialog, StepTools } from "@/features/processes/components/step-shared";
import { ACTION_ICONS } from "@/features/processes/icons";
import { stepHref, STEP_TYPE_LABELS, type ProcessDetail, type ProcessRunItem } from "@/features/processes/types";
import { toneColor } from "@/lib/status";
import { squadColor } from "@/lib/theme";
import { cn } from "@/lib/utils";

interface ExecutionModeProps {
  process: ProcessDetail;
  openRun: ProcessRunItem | null;
  projects: DriveProjectOption[];
  receivables: InvoiceReceivableOption[];
}

/**
 * Modo execução (celular): um passo por vez, texto grande e um botão grande de "Concluir e avançar".
 * Sai e volta de onde parou — a posição é o primeiro passo ainda não feito da execução aberta.
 * Decisões viram dois botões, "Sim" e "Não", que levam ao passo certo.
 */
export function ExecutionMode({ process, openRun, projects, receivables }: ExecutionModeProps) {
  const router = useRouter();
  const steps = useMemo(() => process.steps.filter((step) => !step.archived), [process.steps]);
  const [done, setDone] = useState<Set<string>>(new Set(openRun?.done.map((item) => item.stepId)));
  const firstOpen = Math.max(0, steps.findIndex((step) => !done.has(step.id)));
  const [current, setCurrent] = useState(firstOpen);
  const [starting, setStarting] = useState(false);
  const [pending, startTransition] = useTransition();
  const step = steps[Math.min(current, steps.length - 1)];
  const color = squadColor(process.squad) ?? "var(--foreground)";
  const doneCount = steps.filter((item) => done.has(item.id)).length;
  const allDone = steps.length > 0 && doneCount === steps.length;
  const percent = steps.length > 0 ? Math.round((doneCount * 100) / steps.length) : 0;

  if (!step) {
    return <p className="text-sm text-muted-foreground">Este fluxograma ainda não tem passos.</p>;
  }

  const Icon = ACTION_ICONS[step.actionKind];
  const target = stepHref(step);

  function markAndGo(nextIndex: number | null) {
    if (!openRun || !step) return;
    const stepId = step.id;
    const already = done.has(stepId);
    setDone((value) => new Set(value).add(stepId));
    const destination = nextIndex ?? steps.findIndex((item, index) => index > current && !done.has(item.id) && item.id !== stepId);
    setCurrent(destination >= 0 ? destination : current);
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (already) return;
    startTransition(async () => {
      const result = await toggleRunStepAction(openRun.id, stepId, true);
      if (!result.ok) {
        toast.error(result.error);
        setDone((value) => {
          const next = new Set(value);
          next.delete(stepId);
          return next;
        });
      }
    });
  }

  function finish() {
    if (!openRun) return;
    startTransition(async () => {
      const result = await finishRunAction(openRun.id, process.slug);
      if (result.ok) {
        toast.success(result.message);
        router.push(`/fluxogramas/${process.slug}?aba=historico`);
      } else toast.error(result.error);
    });
  }

  const yesIndex = steps.findIndex((item) => item.id === step.branchYesStepId);
  const noIndex = steps.findIndex((item) => item.id === step.branchNoStepId);
  const decision = step.stepType === "decisao" && yesIndex >= 0 && noIndex >= 0;

  return (
    <div className="mx-auto max-w-xl space-y-5 pb-36">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/fluxogramas/${process.slug}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <X className="size-4" aria-hidden />
          Sair do modo execução
        </Link>
        <span className="text-sm font-semibold tabular-nums">
          {doneCount}/{steps.length}
        </span>
      </div>

      <div className="space-y-2">
        <p className="eyebrow">{process.title}</p>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-hover" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-label="Progresso">
          <span className="block h-full rounded-full transition-[width]" style={{ width: `${percent}%`, background: color }} />
        </div>
        {/* Pontos: tocar para ir a qualquer passo. */}
        <div className="flex flex-wrap gap-1.5" aria-label="Passos">
          {steps.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setCurrent(index)}
              aria-label={`Passo ${index + 1}${done.has(item.id) ? " (feito)" : ""}`}
              aria-current={index === current ? "step" : undefined}
              className={cn("size-7 rounded-full border text-[11px] font-bold tabular-nums", index === current ? "border-foreground" : "border-border text-muted-foreground")}
              style={done.has(item.id) ? { background: `color-mix(in srgb, ${color} 25%, transparent)`, borderColor: color, color } : undefined}
            >
              {index + 1}
            </button>
          ))}
        </div>
      </div>

      <article className="space-y-4 rounded-xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-lg font-black tabular-nums"
            style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color, border: `1px solid color-mix(in srgb, ${color} 45%, transparent)` }}
          >
            {current + 1}
          </span>
          <div className="min-w-0 space-y-1.5">
            <h1 className="flex items-start gap-2 text-2xl font-bold leading-tight">
              <Icon className="mt-1.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
              {step.title}
            </h1>
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {step.stepType !== "acao" ? <span className="font-semibold text-foreground">{STEP_TYPE_LABELS[step.stepType]}</span> : null}
              {step.responsibleRole ? (
                <span className="inline-flex items-center gap-1">
                  <User className="size-3.5" aria-hidden />
                  {step.responsibleRole}
                </span>
              ) : null}
              {step.estimatedMinutes ? <span>~{step.estimatedMinutes} min</span> : null}
            </p>
            {step.isBlocking ? (
              <p className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: toneColor("warning") }}>
                <OctagonAlert className="size-4" aria-hidden />
                Não avance sem concluir
              </p>
            ) : null}
          </div>
        </div>

        <div className="text-base [&_p]:text-base">
          <StepBody step={step} steps={steps} onJump={(id) => setCurrent(steps.findIndex((item) => item.id === id))} />
        </div>

        {target ? (
          target.external ? (
            <Button asChild variant="secondary" className="h-12 w-full text-base">
              <a href={target.href} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden />
                Abrir o sistema externo
              </a>
            </Button>
          ) : (
            <Button asChild variant="secondary" className="h-12 w-full text-base">
              <Link href={target.href}>Abrir no HQ</Link>
            </Button>
          )
        ) : null}

        <StepTools step={step} projects={projects} receivables={receivables} contextProjectId={openRun?.contextEntityType === "project" ? openRun.contextEntityId : null} />
      </article>

      {/* Barra fixa no rodapé: o polegar alcança. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 p-4 backdrop-blur">
        <div className="mx-auto flex max-w-xl flex-col gap-2">
          {!openRun ? (
            <Button className="h-14 w-full text-base" onClick={() => setStarting(true)}>
              <Play aria-hidden />
              Começar a execução
            </Button>
          ) : allDone ? (
            <Button className="h-14 w-full text-base" onClick={finish} loading={pending}>
              <CheckCircle2 aria-hidden />
              Concluir execução
            </Button>
          ) : decision ? (
            <div className="grid grid-cols-2 gap-2">
              <Button className="h-14 text-base" onClick={() => markAndGo(yesIndex)} disabled={pending}>
                Sim
              </Button>
              <Button className="h-14 text-base" variant="secondary" onClick={() => markAndGo(noIndex)} disabled={pending}>
                Não
              </Button>
            </div>
          ) : (
            <Button className="h-14 w-full text-base" onClick={() => markAndGo(null)} disabled={pending}>
              {done.has(step.id) ? "Avançar" : "Concluir e avançar"}
              <ArrowRight aria-hidden />
            </Button>
          )}
          <div className="flex justify-between">
            <Button size="sm" variant="ghost" onClick={() => setCurrent((value) => Math.max(0, value - 1))} disabled={current === 0}>
              <ArrowLeft aria-hidden />
              Anterior
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCurrent((value) => Math.min(steps.length - 1, value + 1))} disabled={current >= steps.length - 1}>
              Pular
              <ArrowRight aria-hidden />
            </Button>
          </div>
        </div>
      </div>

      {starting ? <StartRunDialog processId={process.id} projects={projects} onOpenChange={setStarting} onStarted={() => router.refresh()} /> : null}
    </div>
  );
}
