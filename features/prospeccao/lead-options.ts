import "server-only";
import { LEAD_COLUMNS, loadLeadCadences } from "@/features/prospeccao/cadence-queries";
import type { LeadProspect, ProspectFormOptions } from "@/features/prospeccao/types";
import { todayInAppZone } from "@/lib/calendar";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Playbooks ativos e metas ativas (a RLS de goals devolve só as que a pessoa pode ver). */
export async function getProspectFormOptions(supabase: Supabase): Promise<ProspectFormOptions> {
  const [playbooks, goals] = await Promise.all([
    supabase.from("prospect_playbooks").select("id, name, audience, suggested_goal_id").eq("active", true).order("position"),
    supabase.from("goals").select("id, title, starts_on, ends_on").eq("status", "ativa").gte("ends_on", todayInAppZone()).order("ends_on"),
  ]);
  return {
    playbooks: (playbooks.data ?? []).map((row) => ({ id: row.id, name: row.name, audience: row.audience, suggestedGoalId: row.suggested_goal_id })),
    goals: (goals.data ?? []).map((row) => ({ id: row.id, title: row.title, startsOn: row.starts_on, endsOn: row.ends_on })),
  };
}

/** Campos de prospecção de um negócio e, se ele tiver playbook, o estado da cadência. */
export async function getLeadProspect(supabase: Supabase, dealId: string): Promise<LeadProspect | null> {
  const [fields, cadences] = await Promise.all([
    supabase.from("deals").select(LEAD_COLUMNS).eq("id", dealId).maybeSingle(),
    loadLeadCadences(supabase, dealId),
  ]);
  if (!fields.data) return null;
  const cadence = cadences.get(dealId);
  return { fields: fields.data, cadence: cadence ? { playbookName: cadence.playbook.name, state: cadence.state } : null };
}
