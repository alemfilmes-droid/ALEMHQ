import "server-only";
import { loadLeadCadences } from "@/features/prospeccao/cadence-queries";
import type { ProspectFieldsValues } from "@/features/prospeccao/lead-schemas";
import { appZoneToIso } from "@/lib/calendar";
import type { CadenceState } from "@/lib/prospeccao/cadence";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/types";

type Supabase = Awaited<ReturnType<typeof createClient>>;

const empty = (value: string) => value.trim() || null;

/**
 * Grava os campos de prospecção de um lead. Na primeira vez com playbook, a cadência começa agora;
 * o decisor cadastrado pela primeira vez marca a data em que o Toque 1 passa a valer.
 */
export async function writeProspectFields(supabase: Supabase, dealId: string, values: ProspectFieldsValues): Promise<{ error: string | null }> {
  const { data: current, error: readError } = await supabase
    .from("deals")
    .select("prospect_cadence_started_at, prospect_decision_maker_set_at")
    .eq("id", dealId)
    .maybeSingle();
  if (readError || !current) return { error: "Negócio não encontrado ou sem permissão." };

  const now = new Date().toISOString();
  const decisionMakerName = empty(values.decisionMakerName);
  const update: Tables["deals"]["Update"] = {
    prospect_playbook_id: values.playbookId,
    prospect_lead_type: values.leadType,
    prospect_contact_is_decision_maker: values.contactIsDecisionMaker,
    prospect_decision_maker_name: decisionMakerName,
    prospect_decision_maker_role: empty(values.decisionMakerRole),
    prospect_decision_maker_whatsapp: empty(values.decisionMakerWhatsapp),
    prospect_hook: empty(values.hook),
    prospect_goal_id: values.goalId,
    prospect_last_delivered_project: empty(values.lastDeliveredProject),
    prospect_cadence_started_at: current.prospect_cadence_started_at ?? now,
    prospect_decision_maker_set_at: current.prospect_decision_maker_set_at ?? (decisionMakerName ? now : null),
  };
  const { error } = await supabase.from("deals").update(update).eq("id", dealId);
  return { error: error ? "Não foi possível salvar os campos de prospecção." : null };
}

function nextActionLabel(state: CadenceState): string {
  if (state.isReactivation) return "Reativação · WhatsApp (prospecção)";
  return `Toque ${state.currentTouch} · WhatsApp (prospecção)`;
}

/**
 * Espelha o próximo toque na "Próxima ação" do negócio, para o resto do CRM (alertas, Meu dia) ver a
 * mesma data. Sem envio pendente (pausado, em conversa, aguardando decisor), não mexe.
 */
export async function syncNextAction(supabase: Supabase, dealId: string): Promise<void> {
  const cadence = (await loadLeadCadences(supabase, dealId)).get(dealId);
  const state = cadence?.state;
  if (!state?.nextDueDate || !state.applicableScript) return;
  await supabase
    .from("deals")
    .update({ next_action: nextActionLabel(state), next_action_at: appZoneToIso(state.nextDueDate, "09:00") })
    .eq("id", dealId);
}
