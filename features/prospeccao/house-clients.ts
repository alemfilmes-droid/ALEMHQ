import "server-only";
import { appZoneToIso } from "@/lib/calendar";
import { houseOptions, houseReturnOn, planHouseLead, type HouseOrigin } from "@/lib/prospeccao/house-client";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cliente da casa (spec 7.5). A entrega do projeto grava prospect_house_entries (trigger no banco);
 * aqui, na leitura do CRM, cada entrega pendente vira um negócio novo ligado ao original, com o
 * playbook sugerido. Cada linha é reivindicada antes (claimed_at), então duas leituras ao mesmo
 * tempo não criam dois negócios; uma reivindicação esquecida (falha no meio) é retomada em 5 min.
 */

type Admin = ReturnType<typeof createAdminClient>;

const STALE_CLAIM_MS = 5 * 60_000;

async function defaultSdr(admin: Admin): Promise<string | null> {
  const { data: settings } = await admin.from("company_settings").select("prospect_sdr_id").eq("id", true).maybeSingle();
  if (settings?.prospect_sdr_id) return settings.prospect_sdr_id;
  const { data } = await admin
    .from("profile_squads")
    .select("profile:profiles!inner(id, is_active, org_level, created_at)")
    .eq("squad", "comercial")
    .eq("profile.is_active", true)
    .not("profile.org_level", "in", "(master,diretoria,head)");
  return data?.map((row) => row.profile).sort((a, b) => a.created_at.localeCompare(b.created_at))[0]?.id ?? null;
}

async function originOf(admin: Admin, dealId: string | null): Promise<HouseOrigin | null> {
  if (!dealId) return null;
  const { data } = await admin
    .from("deals")
    .select("id, owner_id, primary_contact_id, prospect_playbook_id, prospect_lead_type, prospect_decision_maker_name, prospect_decision_maker_role, prospect_decision_maker_whatsapp")
    .eq("id", dealId)
    .maybeSingle();
  return data
    ? {
        dealId: data.id,
        ownerId: data.owner_id,
        playbookId: data.prospect_playbook_id,
        leadType: data.prospect_lead_type,
        contactId: data.primary_contact_id,
        decisionMakerName: data.prospect_decision_maker_name,
        decisionMakerRole: data.prospect_decision_maker_role,
        decisionMakerWhatsapp: data.prospect_decision_maker_whatsapp,
      }
    : null;
}

type Entry = { project_id: string; company_id: string; project_name: string; delivered_at: string; origin_deal_id: string | null };

async function createHouseLead(admin: Admin, entry: Entry, delayDays: number): Promise<string | null> {
  const [origin, company, contacts, playbooks, suggestions, sdr] = await Promise.all([
    originOf(admin, entry.origin_deal_id),
    admin.from("companies").select("name, segment").eq("id", entry.company_id).maybeSingle(),
    admin
      .from("contacts")
      .select("id, full_name, job_title, phone")
      .eq("company_id", entry.company_id)
      .order("is_decision_maker", { ascending: false })
      .order("is_primary", { ascending: false })
      .limit(1),
    admin.from("prospect_playbooks").select("id, name, audience, active, uses_house_client_script, position, crm_goal, suggested_goal_id"),
    admin.from("prospect_house_suggestions").select("closed_playbook_id, suggested_playbook_id, position"),
    defaultSdr(admin),
  ]);
  const contactRow = contacts.data?.[0];
  const ownerId = origin?.ownerId ?? sdr;
  if (!company.data || !ownerId) return null;

  const plan = planHouseLead({
    origin,
    contact: contactRow ? { id: contactRow.id, name: contactRow.full_name, role: contactRow.job_title, phone: contactRow.phone } : null,
    companyIsSchool: /escola|col[eé]gio/i.test(company.data.segment ?? ""),
    defaultOwnerId: ownerId,
  });
  const playbookRows = playbooks.data ?? [];
  const [chosenId] = houseOptions(
    plan.closedPlaybookId,
    (suggestions.data ?? []).map((row) => ({ closedPlaybookId: row.closed_playbook_id, suggestedPlaybookId: row.suggested_playbook_id, position: row.position })),
    playbookRows.map((row) => ({ id: row.id, audience: row.audience, active: row.active, usesHouseClientScript: row.uses_house_client_script, position: row.position })),
    plan.audience,
  );
  const playbook = playbookRows.find((row) => row.id === chosenId);
  if (!playbook) return null;

  const returnOn = houseReturnOn(entry.delivered_at, delayDays);
  const { data, error } = await admin
    .from("deals")
    .insert({
      company_id: entry.company_id,
      primary_contact_id: plan.contactId,
      title: `${playbook.name} · ${company.data.name}`,
      owner_id: plan.ownerId,
      prospection_goals: [playbook.crm_goal],
      next_action: "Cliente da casa · WhatsApp (prospecção)",
      next_action_at: appZoneToIso(returnOn, "09:00"),
      created_by: null,
      prospect_playbook_id: playbook.id,
      prospect_lead_type: plan.audience,
      prospect_contact_is_decision_maker: true,
      prospect_decision_maker_name: plan.decisionMakerName,
      prospect_decision_maker_role: plan.decisionMakerRole,
      prospect_decision_maker_whatsapp: plan.decisionMakerWhatsapp,
      prospect_decision_maker_set_at: plan.decisionMakerName ? new Date().toISOString() : null,
      prospect_goal_id: playbook.suggested_goal_id,
      prospect_last_delivered_project: entry.project_name,
      prospect_cadence_started_at: new Date().toISOString(),
      prospect_house_return_on: returnOn,
      prospect_origin_deal_id: plan.originDealId,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Cliente da casa: não foi possível criar o negócio (${error?.message ?? "sem retorno"}).`);
  return data.id;
}

/** Cria os negócios das entregas pendentes. Chamado na leitura do CRM; sem pendências, é uma consulta só. */
export async function materializeHouseClients(): Promise<void> {
  const admin = createAdminClient();
  const staleBefore = new Date(Date.now() - STALE_CLAIM_MS).toISOString();
  const { data: pending } = await admin
    .from("prospect_house_entries")
    .select("project_id")
    .is("deal_id", null)
    .is("cancelled_at", null)
    .or(`claimed_at.is.null,claimed_at.lt.${staleBefore}`)
    .limit(20);
  if (!pending?.length) return;

  const { data: settings } = await admin.from("prospect_settings").select("house_client_delay_days").eq("id", true).maybeSingle();
  const delayDays = settings?.house_client_delay_days ?? 7;

  for (const { project_id } of pending) {
    const { data: claimed } = await admin
      .from("prospect_house_entries")
      .update({ claimed_at: new Date().toISOString() })
      .eq("project_id", project_id)
      .is("deal_id", null)
      .is("cancelled_at", null)
      .or(`claimed_at.is.null,claimed_at.lt.${staleBefore}`)
      .select("project_id, company_id, project_name, delivered_at, origin_deal_id")
      .maybeSingle();
    if (!claimed) continue;
    try {
      const dealId = await createHouseLead(admin, claimed, delayDays);
      await admin.from("prospect_house_entries").update(dealId ? { deal_id: dealId } : { claimed_at: null }).eq("project_id", project_id);
    } catch (error) {
      await admin.from("prospect_house_entries").update({ claimed_at: null }).eq("project_id", project_id);
      console.error(error);
    }
  }
}
