import "server-only";
import { loadLeadCadences, type LeadCadence } from "@/features/prospeccao/cadence-queries";
import type { MessageInput } from "@/lib/prospeccao/message";
import type { createClient } from "@/lib/supabase/server";

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Tudo o que a montagem da mensagem precisa para um lead: estado, scripts, playbook, contato e decisor. */
export async function loadMessageInput(supabase: Supabase, dealId: string, now: Date = new Date()): Promise<{ cadence: LeadCadence; input: MessageInput } | null> {
  const [cadences, deal, scripts] = await Promise.all([
    loadLeadCadences(supabase, dealId),
    supabase
      .from("deals")
      .select("company:companies(name), contact:contacts!deals_primary_contact_id_fkey(full_name, phone)")
      .eq("id", dealId)
      .maybeSingle(),
    supabase.from("prospect_scripts").select("id, kind, playbook_id, touch_number, touch_zero_variant, audience, body"),
  ]);
  const cadence = cadences.get(dealId);
  if (!cadence || !deal.data) return null;
  const { data: playbook } = await supabase
    .from("prospect_playbooks")
    .select("id, touch_zero_variant, link_base, link_appends_school_param, case_text")
    .eq("id", cadence.playbook.id)
    .maybeSingle();
  if (!playbook) return null;

  const lead = cadence.lead;
  return {
    cadence,
    input: {
      state: cadence.state,
      now,
      scripts: (scripts.data ?? []).map((row) => ({
        id: row.id,
        kind: row.kind,
        playbookId: row.playbook_id,
        touchNumber: row.touch_number,
        touchZeroVariant: row.touch_zero_variant,
        audience: row.audience,
        body: row.body,
      })),
      playbook: {
        id: playbook.id,
        touchZeroVariant: playbook.touch_zero_variant,
        linkBase: playbook.link_base,
        linkAppendsSchoolParam: playbook.link_appends_school_param,
        caseText: playbook.case_text,
      },
      lead: {
        name: deal.data.company?.name ?? "",
        audience: lead.prospect_lead_type ?? cadence.playbook.audience,
        contactName: deal.data.contact?.full_name ?? null,
        contactPhone: deal.data.contact?.phone ?? null,
        contactIsDecisionMaker: lead.prospect_contact_is_decision_maker ?? true,
        decisionMakerName: lead.prospect_decision_maker_name,
        decisionMakerWhatsapp: lead.prospect_decision_maker_whatsapp,
        hook: lead.prospect_hook,
        lastDeliveredProject: lead.prospect_last_delivered_project,
      },
    },
  };
}
