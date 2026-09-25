import type { Cents } from "@/features/finance/money";
import type { CompanySource, DealInteractionChannel } from "@/types";

export interface ClientOverview {
  projectsTotal: number;
  projectsActive: number;
  projectsDelivered: number;
  projectsCancelled: number;
  pautasOpen: number;
  clientSince: string | null;
  source: CompanySource | null;
  lastDelivered: { at: string; projectId: string; name: string } | null;
  nextDelivery: { date: string; label: string; projectId: string | null } | null;
  /** Só para quem tem acesso ao CRM. */
  crm: {
    won: number;
    lost: number;
    conversionRate: number | null;
    negotiationValue: Cents;
    lastInteractionAt: string | null;
    lastInteractionChannel: DealInteractionChannel | null;
  } | null;
}

export type TimelineKind = "cadastro" | "virou_cliente" | "projeto_criado" | "projeto_entregue" | "negocio_ganho" | "negocio_perdido" | "saude";

export interface TimelineEvent {
  at: string;
  kind: TimelineKind;
  label: string | null;
  refId: string | null;
  meta: Record<string, unknown>;
}
