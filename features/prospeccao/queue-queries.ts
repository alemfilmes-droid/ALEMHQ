import "server-only";
import { loadLeadCadences, type LeadCadence } from "@/features/prospeccao/cadence-queries";
import type { QueueItem } from "@/features/prospeccao/types";
import { compareQueue, isDueNow } from "@/lib/prospeccao/cadence";
import { materializeHouseClients } from "@/features/prospeccao/house-clients";
import { houseOptions } from "@/lib/prospeccao/house-client";
import { meetingStep } from "@/lib/prospeccao/meeting";
import { recipientPhone } from "@/lib/prospeccao/message";
import { DEFAULT_DDD, normalizeWhatsapp } from "@/lib/prospeccao/phone";
import { createClient } from "@/lib/supabase/server";

/** Fila: atrasados, de hoje e reativações primeiro (na ordem da fila); depois o resto por data. */
export function sortQueue(items: QueueItem[]): QueueItem[] {
  return [...items].sort((a, b) => {
    const due = Number(isDueNow(b.state)) - Number(isDueNow(a.state));
    return due || compareQueue(a.state, b.state) || a.leadName.localeCompare(b.leadName);
  });
}

/** Aviso do telefone de quem recebe o próximo toque: DDD assumido ou número inválido. */
function phoneNotice(cadence: LeadCadence, contactPhone: string | null): string | null {
  if (!cadence.state.applicableScript) return null;
  const { phone, missing } = recipientPhone(
    {
      contactPhone,
      contactIsDecisionMaker: cadence.lead.prospect_contact_is_decision_maker ?? true,
      decisionMakerWhatsapp: cadence.lead.prospect_decision_maker_whatsapp,
    },
    cadence.state.applicableScript.kind === "toque_zero",
  );
  if (!phone?.trim()) return missing;
  const normalized = normalizeWhatsapp(phone);
  if (!normalized.ok) return normalized.error;
  return normalized.assumedDdd ? `DDD assumido: ${DEFAULT_DDD} — confira` : null;
}

type PlaybookRow = { id: string; name: string; audience: "escola" | "empresa"; active: boolean; uses_house_client_script: boolean; position: number };
type SuggestionRow = { closed_playbook_id: string; suggested_playbook_id: string; position: number };

/** Cliente da casa no card: as opções de playbook (padrão primeiro) e se ainda dá para trocar. */
function houseContext(playbooks: PlaybookRow[], suggestions: SuggestionRow[], origins: { id: string; prospect_playbook_id: string | null }[]) {
  const names = new Map(playbooks.map((row) => [row.id, row.name]));
  const closedOf = new Map(origins.map((row) => [row.id, row.prospect_playbook_id]));
  return (cadence: LeadCadence): QueueItem["house"] => {
    if (!cadence.lead.prospect_house_return_on) return null;
    const ids = houseOptions(
      cadence.lead.prospect_origin_deal_id ? (closedOf.get(cadence.lead.prospect_origin_deal_id) ?? null) : null,
      suggestions.map((row) => ({ closedPlaybookId: row.closed_playbook_id, suggestedPlaybookId: row.suggested_playbook_id, position: row.position })),
      playbooks.map((row) => ({ id: row.id, audience: row.audience, active: row.active, usesHouseClientScript: row.uses_house_client_script, position: row.position })),
      cadence.lead.prospect_lead_type ?? cadence.playbook.audience,
    );
    const options = [...new Set([cadence.playbook.id, ...ids])].map((id) => ({ id, name: names.get(id) ?? "Playbook" }));
    return { options, canSwitch: cadence.sentCount === 0 && options.length > 1 };
  };
}

/** Todos os leads com playbook que a pessoa enxerga, com o status calculado. Consultas fixas, sem N+1. */
export async function listProspectItems(): Promise<QueueItem[]> {
  await materializeHouseClients();
  const supabase = await createClient();
  const [cadences, names, pending, meetings, playbooks, suggestions] = await Promise.all([
    loadLeadCadences(supabase),
    supabase
      .from("deals")
      .select("id, title, company:companies(name), contact:contacts!deals_primary_contact_id_fkey(phone)")
      .not("prospect_playbook_id", "is", null),
    supabase.from("prospect_pending_sends").select("deal_id"),
    supabase.from("deal_meetings").select("id, deal_id, scheduled_at, duration_minutes, commitment:commitments(meet_link)").is("result", null),
    supabase.from("prospect_playbooks").select("id, name, audience, active, uses_house_client_script, position"),
    supabase.from("prospect_house_suggestions").select("closed_playbook_id, suggested_playbook_id, position"),
  ]);
  const houseOrigins = [...cadences.values()].map((item) => item.lead.prospect_origin_deal_id).filter((id): id is string => Boolean(id));
  const { data: origins } = houseOrigins.length
    ? await supabase.from("deals").select("id, prospect_playbook_id").in("id", houseOrigins)
    : { data: [] };
  const house = houseContext(playbooks.data ?? [], suggestions.data ?? [], origins ?? []);
  if (names.error) throw new Error(`Falha ao carregar os leads da prospecção: ${names.error.message}`);
  const byId = new Map((names.data ?? []).map((row) => [row.id, row]));
  const withPending = new Set((pending.data ?? []).map((row) => row.deal_id));
  const now = new Date();
  const meetingByDeal = new Map(
    (meetings.data ?? []).map((row) => {
      const endsAt = new Date(Date.parse(row.scheduled_at) + row.duration_minutes * 60_000).toISOString();
      const facts = { startsAt: row.scheduled_at, endsAt };
      return [row.deal_id, { id: row.id, ...facts, meetLink: row.commitment?.meet_link ?? null, awaitingOutcome: meetingStep(facts, now) === "aconteceu" }];
    }),
  );

  const items: QueueItem[] = [];
  for (const cadence of cadences.values()) {
    const row = byId.get(cadence.dealId);
    items.push({
      dealId: cadence.dealId,
      leadName: row?.company?.name ?? row?.title ?? "Lead",
      title: row?.title ?? "",
      playbookName: cadence.playbook.name,
      state: cadence.state,
      hasPending: withPending.has(cadence.dealId),
      phoneNotice: phoneNotice(cadence, row?.contact?.phone ?? null),
      meeting: meetingByDeal.get(cadence.dealId) ?? null,
      house: house(cadence),
    });
  }
  return sortQueue(items);
}
