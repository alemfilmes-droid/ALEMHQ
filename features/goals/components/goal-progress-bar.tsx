import { percentOf } from "@/features/goals/progress";
import { toneColor } from "@/lib/status";
import { cn } from "@/lib/utils";

interface GoalProgressBarProps {
  target: number;
  approved: number;
  pending: number;
  minAchievementPct: number;
  /** Onde a meta deveria estar hoje (ritmo linear); omitido = sem marcador. */
  expected?: number;
  size?: "sm" | "md";
  className?: string;
}

const clamp = (value: number) => Math.min(Math.max(value, 0), 100);

/**
 * Barra da meta em duas camadas: sólido = aprovado; listrado = a confirmar. Traço vertical no
 * gatilho da comissão e um marcador "hoje" no ritmo esperado.
 */
export function GoalProgressBar({ target, approved, pending, minAchievementPct, expected, size = "md", className }: GoalProgressBarProps) {
  const approvedPct = clamp(percentOf(approved, target));
  const pendingPct = clamp(percentOf(approved + pending, target)) - approvedPct;
  const success = toneColor("success") ?? "var(--foreground)";
  const warning = toneColor("warning") ?? "var(--muted-foreground)";
  const expectedPct = expected == null ? null : clamp(percentOf(expected, target));

  return (
    <div className={cn("relative", size === "md" ? "pt-1" : null, className)}>
      <div
        role="progressbar"
        aria-label="Progresso da meta"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percentOf(approved, target))}
        className={cn("relative w-full overflow-hidden rounded-full bg-surface-hover", size === "md" ? "h-3" : "h-2")}
      >
        <span className="absolute inset-y-0 left-0 rounded-full transition-[width]" style={{ width: `${approvedPct}%`, background: success }} />
        {pendingPct > 0 ? (
          <span
            className="absolute inset-y-0"
            title="A confirmar"
            style={{
              left: `${approvedPct}%`,
              width: `${pendingPct}%`,
              background: `repeating-linear-gradient(135deg, ${warning} 0 4px, transparent 4px 8px)`,
              opacity: 0.8,
            }}
          />
        ) : null}
      </div>
      {minAchievementPct > 0 && minAchievementPct < 100 ? (
        <span
          aria-hidden
          title={`Comissão a partir de ${minAchievementPct}%`}
          className={cn("absolute w-0.5 rounded-full bg-foreground/70", size === "md" ? "-bottom-1 top-0" : "-bottom-0.5 -top-0.5")}
          style={{ left: `${minAchievementPct}%` }}
        />
      ) : null}
      {expectedPct != null && size === "md" ? (
        <span
          aria-hidden
          title="Onde a meta deveria estar hoje"
          className="absolute -bottom-2.5 size-0 -translate-x-1/2 border-x-[5px] border-b-[6px] border-x-transparent border-b-muted-foreground"
          style={{ left: `${expectedPct}%` }}
        />
      ) : null}
    </div>
  );
}
