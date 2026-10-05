"use client";

import { CornerDownRight, CornerUpLeft, ExternalLink, OctagonAlert } from "lucide-react";
import { ACTION_ICONS } from "@/features/processes/icons";
import { isInsideHq, STEP_TYPE_LABELS, type ProcessStepItem } from "@/features/processes/types";
import { toneColor } from "@/lib/status";
import { ACCENT, squadColor } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { Squad } from "@/types";

interface ProcessFlowchartProps {
  steps: ProcessStepItem[];
  squad: Squad;
  /** Passos já feitos na execução aberta (opcional). */
  done?: Set<string>;
  activeId?: string | null;
  onSelect: (stepId: string) => void;
}

/** Seta vertical entre dois nós (SVG), com rótulo opcional ("Sim"). */
function Connector({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 pl-[1.375rem]" aria-hidden>
      <svg width="16" height="30" viewBox="0 0 16 30" className="text-border-strong">
        <line x1="8" y1="0" x2="8" y2="24" stroke="currentColor" strokeWidth="2" />
        <path d="M3 21 L8 28 L13 21" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label ? (
        <span className="text-[11px] font-bold uppercase tracking-[0.15em]" style={{ color: toneColor("success") }}>
          {label}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Fluxograma vertical: um nó por passo, ligados por setas. Passos dentro do Além HQ ganham o acento;
 * passos em sistemas externos ficam tracejados, com o ícone de link externo — dá para ver quando a
 * pessoa sai do sistema. Decisões mostram as saídas "Sim" e "Não". Clicar abre o passo abaixo.
 */
export function ProcessFlowchart({ steps, squad, done, activeId, onSelect }: ProcessFlowchartProps) {
  const color = squadColor(squad) ?? "var(--foreground)";
  const indexOf = new Map(steps.map((step, index) => [step.id, index]));

  return (
    <ol aria-label="Fluxograma do processo" className="space-y-0">
      {steps.map((step, index) => {
        const Icon = ACTION_ICONS[step.actionKind];
        const inside = isInsideHq(step);
        const external = step.systemArea === "externo";
        const isDone = done?.has(step.id) ?? false;
        const yesIndex = step.branchYesStepId ? indexOf.get(step.branchYesStepId) : undefined;
        const noIndex = step.branchNoStepId ? indexOf.get(step.branchNoStepId) : undefined;
        const decision = step.stepType === "decisao";
        const next = steps[index + 1];
        const yesIsNext = decision && yesIndex === index + 1;

        return (
          <li key={step.id} className="break-inside-avoid">
            <button
              type="button"
              onClick={() => onSelect(step.id)}
              aria-current={activeId === step.id ? "step" : undefined}
              className={cn(
                "group relative flex w-full max-w-2xl items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
                external ? "border-dashed border-border-strong" : "border-border",
                step.stepType === "espera" && "border-dashed",
                activeId === step.id && "ring-1 ring-foreground/40",
                isDone && "opacity-60",
              )}
              style={
                inside
                  ? { borderColor: `color-mix(in srgb, ${ACCENT} 45%, var(--border))`, boxShadow: `0 0 18px -10px ${ACCENT}` }
                  : decision
                    ? { borderColor: `color-mix(in srgb, ${color} 55%, var(--border))` }
                    : undefined
              }
            >
              {/* Número: losango para decisões, círculo para o resto. */}
              {decision ? (
                <span className="flex size-9 shrink-0 items-center justify-center" aria-hidden>
                  <span
                    className="flex size-6 rotate-45 items-center justify-center rounded-[3px]"
                    style={{ background: `color-mix(in srgb, ${color} 20%, transparent)`, border: `1.5px solid ${color}` }}
                  >
                    <span className="-rotate-45 text-[11px] font-black tabular-nums" style={{ color }}>
                      {index + 1}
                    </span>
                  </span>
                </span>
              ) : (
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-black tabular-nums"
                  style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color, border: `1px solid color-mix(in srgb, ${color} 45%, transparent)` }}
                  aria-hidden
                >
                  {index + 1}
                </span>
              )}
              <span className="sr-only">Passo {index + 1}:</span>
              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm font-semibold leading-snug", isDone && "line-through")}>{step.title}</span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5">
                  {step.responsibleRole ? (
                    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">{step.responsibleRole}</span>
                  ) : null}
                  {step.stepType !== "acao" ? (
                    <span className="rounded-full border border-border-strong px-2 py-0.5 text-[11px] font-semibold">{STEP_TYPE_LABELS[step.stepType]}</span>
                  ) : null}
                  {step.isBlocking ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: toneColor("warning") }}>
                      <OctagonAlert className="size-3" aria-hidden />
                      Não avance sem concluir
                    </span>
                  ) : null}
                </span>
              </span>
              {external ? (
                <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                  <ExternalLink className="size-3.5" aria-hidden />
                  <span className="hidden sm:inline">Fora do HQ</span>
                </span>
              ) : inside ? (
                <span className="hidden shrink-0 text-[11px] font-semibold sm:inline" style={{ color: ACCENT }}>
                  No HQ
                </span>
              ) : null}
            </button>

            {decision ? (
              <div className="ml-[1.375rem] mt-1 space-y-1 border-l-2 border-dashed border-border pl-4 pt-1 text-[12px]">
                {yesIndex !== undefined && !yesIsNext ? (
                  <BranchLink label="Sim" tone="success" target={yesIndex} title={steps[yesIndex]?.title} back={yesIndex < index} onSelect={() => onSelect(steps[yesIndex]!.id)} />
                ) : null}
                {noIndex !== undefined ? (
                  <BranchLink label="Não" tone="danger" target={noIndex} title={steps[noIndex]?.title} back={noIndex < index} onSelect={() => onSelect(steps[noIndex]!.id)} />
                ) : null}
              </div>
            ) : null}

            {next ? <Connector label={yesIsNext ? "Sim" : undefined} /> : null}
          </li>
        );
      })}
    </ol>
  );
}

function BranchLink({ label, tone, target, title, back, onSelect }: { label: string; tone: "success" | "danger"; target: number; title?: string; back: boolean; onSelect: () => void }) {
  const Icon = back ? CornerUpLeft : CornerDownRight;
  return (
    <button type="button" onClick={onSelect} className="flex items-center gap-1.5 rounded-sm text-left hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
      <span className="font-bold uppercase tracking-[0.12em]" style={{ color: toneColor(tone) }}>
        {label}
      </span>
      <Icon className="size-3.5 text-muted-foreground" aria-hidden />
      <span className="text-muted-foreground">
        {back ? "volta ao" : "vai para o"} passo {target + 1}
        {title ? `: ${title}` : ""}
      </span>
    </button>
  );
}
