import { MessageSquareWarning } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/ui/status-dot";
import { DealStageBadge } from "@/features/crm/components/deal-stage-badge";
import { pautaStatusLabel } from "@/lib/pautas";
import { PAUTA_STATUS_TONE } from "@/lib/status";
import type { PautaStatus, PautaWithDetails, Squad } from "@/types";

/** Status no vocabulário do squad da pauta (ex.: "A fazer" e "Concluída" fora do audiovisual). */
export function PautaStatusBadge({ status, squad }: { status: PautaStatus; squad?: Squad | null }) {
  return (
    <Badge variant="outline">
      <StatusDot tone={PAUTA_STATUS_TONE[status]} />
      {pautaStatusLabel(status, squad)}
    </Badge>
  );
}

/**
 * O rótulo que a pauta mostra no quadro: a etapa do negócio (pauta do CRM), o encerramento
 * ("Encerrado — fim de contrato") ou o status do squad.
 */
export function PautaStageBadge({ pauta }: { pauta: Pick<PautaWithDetails, "deal_stage" | "closure_label" | "status" | "squad"> }) {
  if (pauta.deal_stage) return <DealStageBadge stage={pauta.deal_stage} />;
  if (pauta.closure_label) {
    return (
      <Badge variant="outline">
        <StatusDot tone="neutral" />
        {pauta.closure_label}
      </Badge>
    );
  }
  return <PautaStatusBadge status={pauta.status!} squad={pauta.squad} />;
}

/** Pedidos de direcionamento ainda abertos no negócio desta pauta. */
export function OpenRequestsBadge({ count }: { count: number | null | undefined }) {
  if (!count) return null;
  return (
    <Badge variant="outline" title={`${count} direcionamento(s) aguardando resolução`}>
      <MessageSquareWarning className="size-3" aria-hidden />
      {count} {count === 1 ? "pedido" : "pedidos"}
    </Badge>
  );
}
