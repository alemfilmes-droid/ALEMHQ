import type { ReactNode } from "react";
import { PrivacyCardToggle } from "@/components/privacy/privacy-mode";
import { Metric, MetricGrid } from "@/components/ui/metric-value";
import type { ClientOverview } from "@/features/clients/types";
import { INTERACTION_CHANNEL_LABELS } from "@/features/crm/labels";
import type { ClientFinanceSummary } from "@/features/finance/queries";
import { SOURCE_LABELS } from "@/lib/domain";
import { formatDateShort } from "@/lib/format";
import { MARGIN_STATUS_LABELS, MARGIN_STATUS_TONE } from "@/lib/status";

function Group({ title, sensitive = false, children }: { title: string; sensitive?: boolean; children: ReactNode }) {
  return (
    <section aria-label={title} className="card-surface rounded-lg p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="eyebrow">{title}</h3>
        {sensitive ? <PrivacyCardToggle className="-mr-1" /> : null}
      </div>
      <MetricGrid min="8.5rem">{children}</MetricGrid>
    </section>
  );
}

function dateOnly(value: string): string {
  return formatDateShort(value.slice(0, 10));
}

/**
 * Faixa de indicadores da visão geral do cliente. Cada grupo só aparece para quem pode vê-lo:
 * operação para todos, comercial com acesso ao CRM, financeiro com acesso ao financeiro.
 */
export function ClientMetrics({ overview, finance }: { overview: ClientOverview; finance: ClientFinanceSummary | null }) {
  const { crm } = overview;

  return (
    <div className="mb-10 space-y-4">
      <Group title="Operação">
        <Metric label="Projetos" value={overview.projectsTotal} />
        <Metric label="Projetos ativos" value={overview.projectsActive} tone={overview.projectsActive > 0 ? "warning" : undefined} />
        <Metric label="Entregues" value={overview.projectsDelivered} tone={overview.projectsDelivered > 0 ? "success" : undefined} />
        <Metric label="Cancelados" value={overview.projectsCancelled} />
        <Metric label="Pautas em andamento" value={overview.pautasOpen} />
        <Metric label="Cliente desde" value={overview.clientSince ? dateOnly(overview.clientSince) : null} format="text" />
        <Metric
          label="Último projeto entregue"
          value={overview.lastDelivered ? dateOnly(overview.lastDelivered.at) : null}
          format="text"
          note={overview.lastDelivered?.name}
        />
        <Metric
          label="Próxima entrega"
          value={overview.nextDelivery ? formatDateShort(overview.nextDelivery.date) : null}
          format="text"
          note={overview.nextDelivery?.label}
        />
      </Group>

      {crm ? (
        <Group title="Comercial">
          <Metric label="Negócios ganhos" value={crm.won} tone={crm.won > 0 ? "success" : undefined} />
          <Metric label="Negócios perdidos" value={crm.lost} tone={crm.lost > 0 ? "danger" : undefined} />
          <Metric label="Taxa de conversão" value={crm.conversionRate} format="percent" note="Ganhos ÷ (ganhos + perdidos)" />
          {crm.negotiationValue != null ? (
            <Metric label="Valor em negociação" value={crm.negotiationValue} format="cents" tone={crm.negotiationValue > 0 ? "warning" : undefined} />
          ) : null}
          <Metric
            label="Última interação comercial"
            value={crm.lastInteractionAt ? dateOnly(crm.lastInteractionAt) : null}
            format="text"
            note={crm.lastInteractionChannel ? INTERACTION_CHANNEL_LABELS[crm.lastInteractionChannel] : undefined}
          />
          <Metric label="Origem" value={overview.source ? SOURCE_LABELS[overview.source] : null} format="text" />
        </Group>
      ) : null}

      {finance ? (
        <Group title="Financeiro" sensitive>
          <Metric label="Faturamento total" value={finance.billed} format="cents" />
          <Metric label="Recebido" value={finance.received} format="cents" tone="success" />
          <Metric label="Em aberto" value={finance.open} format="cents" tone={finance.open > 0 ? "warning" : undefined} />
          <Metric label="Ticket médio por projeto" value={finance.averageTicket} format="cents" />
          <Metric
            label="Margem média"
            value={finance.marginPct}
            format="percent"
            sensitive
            tone={finance.marginStatus ? MARGIN_STATUS_TONE[finance.marginStatus] : undefined}
            note={finance.marginStatus ? MARGIN_STATUS_LABELS[finance.marginStatus] : undefined}
          />
        </Group>
      ) : null}
    </div>
  );
}
