import { ChevronRight } from "lucide-react";
import type { ProcessStepItem } from "@/features/processes/types";
import { squadColor } from "@/lib/theme";
import { cn } from "@/lib/utils";
import type { Squad } from "@/types";

/**
 * Visão geral do processo: os passos numerados em sequência, num fluxo que quebra linha (no celular
 * vira coluna). Só CSS — nada de biblioteca de diagrama. Clicar leva ao passo no checklist.
 */
export function ProcessFlow({ steps, squad }: { steps: ProcessStepItem[]; squad: Squad }) {
  const color = squadColor(squad) ?? "var(--foreground)";
  if (steps.length === 0) return null;
  return (
    <ol aria-label="Visão geral do processo" className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {steps.map((step, index) => (
        <li key={step.id} className="flex items-center gap-2">
          <a
            href={`#passo-${index + 1}`}
            className={cn(
              "flex min-w-0 items-center gap-2 rounded-full border bg-surface-raised py-1.5 pl-1.5 pr-3 text-[13px] transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
              step.isBlocking ? "border-border-strong font-semibold" : "border-border text-muted-foreground",
            )}
          >
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black tabular-nums"
              style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color, border: `1px solid color-mix(in srgb, ${color} 45%, transparent)` }}
            >
              {index + 1}
            </span>
            <span className="truncate sm:max-w-[16rem]">{step.title}</span>
          </a>
          {index < steps.length - 1 ? <ChevronRight className="hidden size-4 shrink-0 text-subtle sm:block" aria-hidden /> : null}
        </li>
      ))}
    </ol>
  );
}
