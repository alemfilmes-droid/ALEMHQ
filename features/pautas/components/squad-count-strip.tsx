import { StatusDot } from "@/components/ui/status-dot";
import { SQUAD_LABELS } from "@/lib/auth/squads";
import { SQUAD_TONE } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { Squad } from "@/types";

interface SquadCountStripProps {
  counts: { squad: Squad; count: number }[];
  activeSquad: Squad | null;
  /** Clicar no squad ativo limpa o filtro; em outro, filtra só por ele. */
  onToggle: (squad: Squad) => void;
}

/** "12 Comercial · 8 Audiovisual · …" — contagem por squad da pauta, clicável para filtrar (/pautas e /minhas-pautas). */
export function SquadCountStrip({ counts, activeSquad, onToggle }: SquadCountStripProps) {
  if (counts.length === 0) return null;
  return (
    <ul aria-label="Pautas por squad" className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs">
      {counts.map(({ squad, count }, index) => {
        const active = activeSquad === squad;
        return (
          <li key={squad} className="flex items-center">
            {index > 0 ? (
              <span aria-hidden className="px-1 text-subtle">
                ·
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => onToggle(squad)}
              aria-pressed={active}
              title={active ? "Mostrar todos os squads" : `Mostrar só ${SQUAD_LABELS[squad]}`}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-semibold transition-colors",
                active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:bg-surface-hover hover:text-foreground",
              )}
            >
              <StatusDot tone={SQUAD_TONE[squad]} />
              <span className="tabular-nums">{count}</span>
              {SQUAD_LABELS[squad]}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
