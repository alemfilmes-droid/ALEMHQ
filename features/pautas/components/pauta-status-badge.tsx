import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/ui/status-dot";
import { PAUTA_STATUS_LABELS } from "@/lib/pautas";
import { PAUTA_STATUS_TONE } from "@/lib/status";
import type { PautaStatus } from "@/types";

export function PautaStatusBadge({ status }: { status: PautaStatus }) {
  return (
    <Badge variant="outline">
      <StatusDot tone={PAUTA_STATUS_TONE[status]} />
      {PAUTA_STATUS_LABELS[status]}
    </Badge>
  );
}
