import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/ui/status-dot";
import { LIFECYCLE_LABELS, SOURCE_LABELS, TIER_LABELS } from "@/lib/domain";
import { CLIENT_HEALTH_LABELS, CLIENT_HEALTH_TONE } from "@/lib/status";
import type { Company } from "@/types";

export function LifecycleBadge({ lifecycle }: { lifecycle: Company["lifecycle"] }) {
  return <Badge variant={lifecycle === "client" ? "solid" : "outline"}>{LIFECYCLE_LABELS[lifecycle]}</Badge>;
}

export function SourceBadge({ source }: { source: Company["source"] }) {
  return source ? <Badge variant="muted">{SOURCE_LABELS[source]}</Badge> : null;
}

export function TierBadge({ tier }: { tier: Company["tier"] }) {
  return tier ? <Badge variant="outline">{TIER_LABELS[tier]}</Badge> : null;
}

/** Ponto de saúde (8px) + rótulo. Usado nas listas — o nome do cliente permanece branco. */
export function HealthDot({ health, showLabel = false }: { health: Company["health"]; showLabel?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <StatusDot tone={CLIENT_HEALTH_TONE[health]} label={CLIENT_HEALTH_LABELS[health]} />
      {showLabel ? <span className="text-[13px] font-semibold text-muted-foreground">{CLIENT_HEALTH_LABELS[health]}</span> : null}
    </span>
  );
}

/** "Origem: Indicação — Fulano" */
export function sourceSummary(company: Pick<Company, "source" | "source_detail">) {
  if (!company.source) return null;
  const label = SOURCE_LABELS[company.source];
  return company.source_detail ? `Origem: ${label} — ${company.source_detail}` : `Origem: ${label}`;
}
