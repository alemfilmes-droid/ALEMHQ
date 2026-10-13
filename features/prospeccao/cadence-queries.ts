import "server-only";
import { DEAL_STAGES } from "@/features/crm/labels";
import { getCadenceState, type CadenceLead, type CadenceRules, type CadenceState, type FunnelPosition, type SentTouch } from "@/lib/prospeccao/cadence";
import { todayInAppZone } from "@/lib/calendar";
import { holidayCalendar, type HolidayCalendar } from "@/lib/prospeccao/time";
import { createClient } from "@/lib/supabase/server";
import type { DealStage, ProspectAudience, ProspectTouchZeroVariant, Tables } from "@/types";

/**
 * Leitura da cadência para o CRM. Número fixo de consultas, qualquer que seja o tamanho da lista
 * (sem N+1): playbooks, cadências, feriados, reativações, leads com playbook e toques — e o status
 * de cada lead sai de getCadenceState (fonte única).
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const LEAD_COLUMNS =
  "id, stage, archived_at, next_action_at, prospect_playbook_id, prospect_lead_type, prospect_contact_is_decision_maker, prospect_decision_maker_name, prospect_decision_maker_role, prospect_decision_maker_whatsapp, prospect_decision_maker_set_at, prospect_hook, prospect_goal_id, prospect_last_delivered_project, prospect_cadence_started_at, prospect_replied_at, prospect_paused_at, prospect_pause_reason, prospect_resumed_at, prospect_discarded_at, prospect_discard_reason, prospect_manual_reactivation_on, prospect_cadence_restarted_at, prospect_house_return_on, prospect_origin_deal_id, prospect_override_touch, prospect_override_due, prospect_override_at, prospect_removed_at" as const;

export type ProspectLeadRow = Pick<
  Tables["deals"]["Row"],
  | "id"
  | "stage"
  | "archived_at"
  | "next_action_at"
  | "prospect_playbook_id"
  | "prospect_lead_type"
  | "prospect_contact_is_decision_maker"
  | "prospect_decision_maker_name"
  | "prospect_decision_maker_role"
  | "prospect_decision_maker_whatsapp"
  | "prospect_decision_maker_set_at"
  | "prospect_hook"
  | "prospect_goal_id"
  | "prospect_last_delivered_project"
  | "prospect_cadence_started_at"
  | "prospect_replied_at"
  | "prospect_paused_at"
  | "prospect_pause_reason"
  | "prospect_resumed_at"
  | "prospect_discarded_at"
  | "prospect_discard_reason"
  | "prospect_manual_reactivation_on"
  | "prospect_cadence_restarted_at"
  | "prospect_house_return_on"
  | "prospect_origin_deal_id"
  | "prospect_override_touch"
  | "prospect_override_due"
  | "prospect_override_at"
  | "prospect_removed_at"
>;

export interface PlaybookCadence {
  id: string;
  name: string;
  audience: ProspectAudience;
  touchZeroVariant: ProspectTouchZeroVariant;
  rules: CadenceRules;
}

export interface CadenceContext {
  today: string;
  calendar: HolidayCalendar;
  playbooks: Map<string, PlaybookCadence>;
}

export interface LeadCadence {
  dealId: string;
  playbook: PlaybookCadence;
  lead: ProspectLeadRow;
  state: CadenceState;
  /** Toques já enviados (o cliente da casa só troca de playbook antes do primeiro). */
  sentCount: number;
}

const MEETING_RANK = DEAL_STAGES.indexOf("reuniao_agendada");

export function funnelPosition(stage: DealStage, archivedAt: string | null): FunnelPosition {
  if (archivedAt || stage === "ganho") return "fechado";
  if (stage === "perdido") return "perdido";
  if (stage === "em_analise") return "analise";
  return DEAL_STAGES.indexOf(stage) >= MEETING_RANK ? "reuniao" : "aberto";
}

export async function loadCadenceContext(supabase: Supabase, now: Date = new Date()): Promise<CadenceContext> {
  const [playbooks, cadences, holidays, reactivations] = await Promise.all([
    supabase.from("prospect_playbooks").select("id, name, audience, cadence_type, touch_zero_variant, uses_house_client_script"),
    supabase.from("prospect_cadences").select("cadence_type, touch_offsets, reactivation_days"),
    supabase.from("prospect_holidays").select("holiday_date, recurring, optional, skip_prospecting"),
    supabase.from("prospect_scripts").select("playbook_id, body").eq("kind", "reativacao"),
  ]);
  const failed = [playbooks, cadences, holidays, reactivations].find((result) => result.error);
  if (failed?.error) throw new Error(`Falha ao carregar a cadência da prospecção: ${failed.error.message}`);

  const map = new Map<string, PlaybookCadence>();
  for (const playbook of playbooks.data ?? []) {
    const cadence = cadences.data?.find((item) => item.cadence_type === playbook.cadence_type);
    if (!cadence) continue;
    const reactivation = reactivations.data?.find((item) => item.playbook_id === playbook.id);
    map.set(playbook.id, {
      id: playbook.id,
      name: playbook.name,
      audience: playbook.audience,
      touchZeroVariant: playbook.touch_zero_variant,
      rules: {
        offsets: cadence.touch_offsets,
        reactivationDays: cadence.reactivation_days,
        reactivationScriptEmpty: !reactivation?.body.trim(),
        usesHouseClientScript: playbook.uses_house_client_script,
      },
    });
  }
  return {
    today: todayInAppZone(now),
    calendar: holidayCalendar(
      (holidays.data ?? []).map((row) => ({ date: row.holiday_date, recurring: row.recurring, skip: !row.optional || row.skip_prospecting })),
    ),
    playbooks: map,
  };
}

export function toCadenceLead(row: ProspectLeadRow): CadenceLead {
  return {
    funnel: funnelPosition(row.stage, row.archived_at),
    contactIsDecisionMaker: row.prospect_contact_is_decision_maker ?? true,
    decisionMakerSetAt: row.prospect_decision_maker_set_at,
    hook: row.prospect_hook,
    lastDeliveredProject: row.prospect_last_delivered_project,
    cadenceStartedAt: row.prospect_cadence_started_at ?? new Date(0).toISOString(),
    repliedAt: row.prospect_replied_at,
    pausedAt: row.prospect_paused_at,
    resumedAt: row.prospect_resumed_at,
    discardedAt: row.prospect_discarded_at,
    manualReactivationOn: row.prospect_manual_reactivation_on,
    restartedAt: row.prospect_cadence_restarted_at,
    houseReturnOn: row.prospect_house_return_on,
    // Em análise, a data de retorno é a próxima ação do negócio (o banco exige as duas juntas).
    analysisReturnOn: row.stage === "em_analise" && row.next_action_at ? todayInAppZone(new Date(row.next_action_at)) : null,
    override:
      row.prospect_override_at && row.prospect_override_touch !== null && row.prospect_override_due
        ? { touch: row.prospect_override_touch, due: row.prospect_override_due, at: row.prospect_override_at }
        : null,
  };
}

/** Estados de cadência dos leads com playbook que a pessoa enxerga (RLS de deals). `dealId` restringe a um. */
export async function loadLeadCadences(supabase: Supabase, dealId?: string): Promise<Map<string, LeadCadence>> {
  // Removido da prospecção pela gestão: fora da cadência e das listas (o negócio segue no funil).
  let leads = supabase.from("deals").select(LEAD_COLUMNS).not("prospect_playbook_id", "is", null).is("prospect_removed_at", null);
  // Toque riscado (abordagem excluída com motivo) não conta na cadência.
  let touches = supabase.from("prospect_touch_logs").select("deal_id, touch_number, sent_at").is("deleted_at", null);
  if (dealId) {
    leads = leads.eq("id", dealId);
    touches = touches.eq("deal_id", dealId);
  }
  const [context, leadsResult, touchesResult] = await Promise.all([loadCadenceContext(supabase), leads, touches]);
  const failure = leadsResult.error ?? touchesResult.error;
  if (failure) throw new Error(`Falha ao carregar os leads da prospecção: ${failure.message}`);

  const touchesByDeal = new Map<string, SentTouch[]>();
  for (const touch of touchesResult.data ?? []) {
    const list = touchesByDeal.get(touch.deal_id) ?? [];
    list.push({ touchNumber: touch.touch_number, sentAt: touch.sent_at });
    touchesByDeal.set(touch.deal_id, list);
  }

  const result = new Map<string, LeadCadence>();
  for (const lead of leadsResult.data ?? []) {
    const playbook = lead.prospect_playbook_id ? context.playbooks.get(lead.prospect_playbook_id) : undefined;
    if (!playbook) continue;
    const sent = touchesByDeal.get(lead.id) ?? [];
    const state = getCadenceState(toCadenceLead(lead), sent, playbook.rules, context.calendar, context.today);
    if (state) result.set(lead.id, { dealId: lead.id, playbook, lead, state, sentCount: sent.length });
  }
  return result;
}
