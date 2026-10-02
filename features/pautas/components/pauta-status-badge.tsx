import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/ui/status-dot";
import { pautaStatusLabel } from "@/lib/pautas";
import { PAUTA_STATUS_TONE } from "@/lib/status";
import type { PautaStatus, Squad } from "@/types";

/** Status no vocabulário do squad da pauta (ex.: "A fazer" e "Concluída" fora do audiovisual). */
export function PautaStatusBadge({ status, squad }: { status: PautaStatus; squad?: Squad | null }) {
  return (
    <Badge variant="outline">
      <StatusDot tone={PAUTA_STATUS_TONE[status]} />
      {pautaStatusLabel(status, squad)}
    </Badge>
  );
}
