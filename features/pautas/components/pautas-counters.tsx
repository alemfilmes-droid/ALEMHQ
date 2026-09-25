import { toneColor } from "@/lib/status";
import type { PautasSummary } from "@/features/pautas/types";

/**
 * Contadores compactos do cabeçalho — não são cards. A cor só entra no número
 * (uso permitido pela paleta semântica), o rótulo fica em texto neutro.
 */
export function PautasCounters({ summary }: { summary: PautasSummary }) {
  const items = [
    { label: "Em andamento", value: summary.emAndamento, tone: "warning" as const },
    { label: "Concluídas", value: summary.concluidas, tone: "success" as const },
    { label: "Críticas", value: summary.criticas, tone: "danger" as const },
  ];

  return (
    <dl aria-label="Resumo das pautas" className="flex flex-wrap items-center gap-x-5 gap-y-1">
      {items.map(({ label, value, tone }) => (
        <div key={label} className="flex items-baseline gap-1.5">
          <dt className="order-2 text-xs font-medium text-muted-foreground">{label}</dt>
          <dd className="order-1 whitespace-nowrap font-display text-lg font-black tabular-nums" style={{ color: toneColor(tone) }}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
