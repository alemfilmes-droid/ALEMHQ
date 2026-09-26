import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/ui/status-dot";
import { SQUAD_LABELS } from "@/lib/auth/squads";
import { SQUAD_TONE } from "@/lib/status";
import type { Squad } from "@/types";

/** Selo de squad: ponto de 8px na cor do squad + nome. Única forma de mostrar um squad em texto. */
export function SquadBadge({ squad, className }: { squad: Squad; className?: string }) {
  return (
    <Badge variant="muted" className={className}>
      <StatusDot tone={SQUAD_TONE[squad]} />
      {SQUAD_LABELS[squad]}
    </Badge>
  );
}
