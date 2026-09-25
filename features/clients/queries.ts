import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { COMPANY_SOURCES } from "@/lib/domain";
import type { ClientOverview, TimelineEvent } from "@/features/clients/types";

const DEAL_CHANNELS = ["email", "whatsapp", "ligacao", "instagram", "linkedin", "presencial", "meet", "outro"] as const;

/** Resposta da função company_overview() — validada, sem `any` e sem confiar no formato do jsonb. */
const overviewSchema = z.object({
  projects_total: z.number(),
  projects_active: z.number(),
  projects_delivered: z.number(),
  projects_cancelled: z.number(),
  pautas_open: z.number(),
  client_since: z.string().nullable(),
  source: z.enum(COMPANY_SOURCES).nullable(),
  last_delivered: z.object({ at: z.string(), project_id: z.string(), name: z.string() }).nullable(),
  next_delivery: z.object({ date: z.string(), label: z.string(), project_id: z.string().nullable() }).nullable(),
  crm: z
    .object({
      won: z.number(),
      lost: z.number(),
      open: z.number(),
      negotiation_value: z.number(),
      last_interaction_at: z.string().optional(),
      last_interaction_channel: z.enum(DEAL_CHANNELS).nullable().optional(),
    })
    .nullable(),
});

/** Números agregados do cliente, calculados no banco (company_overview). null se não puder ver a empresa. */
export async function getClientOverview(companyId: string): Promise<ClientOverview | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("company_overview", { p_company_id: companyId });
  if (error) throw new Error("Falha ao carregar a visão geral do cliente.");
  if (data == null) return null;

  const parsed = overviewSchema.safeParse(data);
  if (!parsed.success) throw new Error("Resposta inesperada da visão geral do cliente.");
  const row = parsed.data;

  return {
    projectsTotal: row.projects_total,
    projectsActive: row.projects_active,
    projectsDelivered: row.projects_delivered,
    projectsCancelled: row.projects_cancelled,
    pautasOpen: row.pautas_open,
    clientSince: row.client_since,
    source: row.source,
    lastDelivered: row.last_delivered ? { at: row.last_delivered.at, projectId: row.last_delivered.project_id, name: row.last_delivered.name } : null,
    nextDelivery: row.next_delivery
      ? { date: row.next_delivery.date, label: row.next_delivery.label, projectId: row.next_delivery.project_id }
      : null,
    crm: row.crm
      ? {
          won: row.crm.won,
          lost: row.crm.lost,
          conversionRate: row.crm.won + row.crm.lost > 0 ? Math.round((row.crm.won / (row.crm.won + row.crm.lost)) * 1000) / 10 : null,
          negotiationValue: Math.round(row.crm.negotiation_value * 100),
          lastInteractionAt: row.crm.last_interaction_at ?? null,
          lastInteractionChannel: row.crm.last_interaction_channel ?? null,
        }
      : null,
  };
}

const TIMELINE_KINDS = ["cadastro", "virou_cliente", "projeto_criado", "projeto_entregue", "negocio_ganho", "negocio_perdido", "saude"] as const;
const metaSchema = z.record(z.string(), z.unknown());

/** Linha do tempo do relacionamento (company_timeline), mais novo primeiro. Pede um a mais para saber se há "ver mais". */
export async function getClientTimeline(companyId: string, limit: number): Promise<{ events: TimelineEvent[]; hasMore: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("company_timeline", { p_company_id: companyId, p_limit: limit + 1 });
  if (error) throw new Error("Falha ao carregar a linha do tempo do cliente.");

  const events: TimelineEvent[] = [];
  for (const row of data ?? []) {
    const kind = TIMELINE_KINDS.find((item) => item === row.kind);
    if (!kind) continue;
    const meta = metaSchema.safeParse(row.meta);
    events.push({ at: row.event_at, kind, label: row.label, refId: row.ref_id, meta: meta.success ? meta.data : {} });
  }
  return { events: events.slice(0, limit), hasMore: events.length > limit };
}
