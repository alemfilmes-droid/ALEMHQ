import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/ui/status-dot";
import { DEAL_STAGE_LABELS } from "@/features/crm/labels";
import { DEAL_STAGE_TONE } from "@/lib/status";
import type { DealStage } from "@/types";

export function DealStageBadge({ stage }: { stage: DealStage }) {
  return (
    <Badge variant="outline">
      <StatusDot tone={DEAL_STAGE_TONE[stage]} />
      {DEAL_STAGE_LABELS[stage]}
    </Badge>
  );
}
