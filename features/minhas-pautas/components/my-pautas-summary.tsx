import { StatusDot } from "@/components/ui/status-dot";
import { SQUAD_LABELS } from "@/lib/auth/squads";
import { SQUAD_TONE, toneColor } from "@/lib/status";
import { cn } from "@/lib/utils";
import type { MyPautasSummary } from "@/features/minhas-pautas/types";
import type { Squad } from "@/types";

interface MyPautasSummaryStripProps {
  summary: MyPautasSummary;
  /** Só para quem está em mais de um squad: contagem por squad de origem, clicável para filtrar. */
  squadCounts?: { squad: Squad; count: number }[];
  activeSquad: Squad | null;
  onSquadToggle: (squad: Squad) => void;
}

/** Tira compacta do cabeçalho — cor só no número (atrasadas = perigo, hoje = atenção) e no ponto do squad. */
export function MyPautasSummaryStrip({ summary, squadCounts, activeSquad, onSquadToggle }: MyPautasSummaryStripProps) {
  const items = [
    { label: "Atrasadas", value: summary.atrasadas, tone: "danger" as const },
    { label: "Hoje", value: summary.hoje, tone: "warning" as const },
    { label: "Esta semana", value: summary.estaSemana, tone: "neutral" as const },
    { label: "Acompanhando", value: summary.acompanhando, tone: "neutral" as const },
  ];

  return (
    <div className="space-y-2">
      <dl aria-label="Resumo das minhas pautas" className="flex flex-wrap items-center gap-x-5 gap-y-1">
        {items.map(({ label, value, tone }) => (
          <div key={label} className="flex items-baseline gap-1.5">
            <dt className="order-2 text-xs font-medium text-muted-foreground">{label}</dt>
            <dd className="order-1 whitespace-nowrap font-display text-lg font-black tabular-nums" style={{ color: value > 0 ? toneColor(tone) : undefined }}>
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {squadCounts && squadCounts.length > 0 ? (
        <ul aria-label="Pautas por squad" className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs">
          {squadCounts.map(({ squad, count }, index) => {
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
                  onClick={() => onSquadToggle(squad)}
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
      ) : null}
    </div>
  );
}
