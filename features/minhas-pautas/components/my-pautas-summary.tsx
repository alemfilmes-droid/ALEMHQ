import { SquadCountStrip } from "@/features/pautas/components/squad-count-strip";
import { toneColor } from "@/lib/status";
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

      {squadCounts ? <SquadCountStrip counts={squadCounts} activeSquad={activeSquad} onToggle={onSquadToggle} /> : null}
    </div>
  );
}
