"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { syncNextAction, writeProspectFields } from "@/features/prospeccao/lead-fields";
import { prospectFieldsSchema, quickLeadSchema, type ProspectFieldsValues, type QuickLeadValues } from "@/features/prospeccao/lead-schemas";
import { appZoneToIso, todayInAppZone } from "@/lib/calendar";
import { hasCapability } from "@/lib/auth/permissions";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; message: string; id?: string } | { ok: false; error: string };

const UNAUTHORIZED: Result = { ok: false, error: "Sessão expirada ou sem acesso ao CRM." };

/** Argumento que a função SQL aceita nulo, mas o gerador de tipos marca como obrigatório. */
function nullArg<T>(): T {
  return null as T;
}

function refresh() {
  revalidatePath("/crm");
  revalidatePath("/inicio");
}

/**
 * Cadastro rápido de prospecção: cria empresa, contato e negócio pelo fluxo normal do CRM e já
 * coloca o lead na cadência do playbook. Contato que decide vira também o decisor.
 */
export async function createProspectLeadAction(values: QuickLeadValues): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile || !hasCapability(profile, "crm")) return UNAUTHORIZED;
  const parsed = quickLeadSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os campos." };
  const d = parsed.data;

  const supabase = await createClient();
  const { data: playbook } = await supabase.from("prospect_playbooks").select("name, crm_goal, active").eq("id", d.playbookId).maybeSingle();
  if (!playbook?.active) return { ok: false, error: "Escolha um playbook ativo." };

  const startsAtTouchZero = !d.contactIsDecisionMaker && !d.decisionMakerName;
  const { data: dealId, error } = await supabase.rpc("crm_create_deal", {
    p_company_id: nullArg<string>(),
    p_company_name: d.leadName,
    p_document: "",
    p_segment: d.leadType === "escola" ? "Escola" : "",
    p_city: "",
    p_instagram: "",
    p_website: "",
    p_source: nullArg<"outro">(),
    p_primary_contact_id: nullArg<string>(),
    p_contact_name: d.contactName,
    p_contact_job_title: d.contactIsDecisionMaker ? d.decisionMakerRole : "",
    p_contact_phone: d.whatsapp,
    p_contact_email: "",
    p_title: `${playbook.name} · ${d.leadName}`,
    p_owner_id: profile.id,
    p_goals: [playbook.crm_goal],
    p_estimated_value: nullArg<number>(),
    p_expected_close_date: nullArg<string>(),
    p_next_action: `${startsAtTouchZero ? "Toque 0" : "Toque 1"} · WhatsApp (prospecção)`,
    p_next_action_at: appZoneToIso(todayInAppZone(), "09:00"),
  });
  if (error || !dealId) return { ok: false, error: error?.code === "23514" ? error.message : "Não foi possível criar o lead." };

  const fields: ProspectFieldsValues = d.contactIsDecisionMaker
    ? { ...d, decisionMakerName: d.contactName, decisionMakerWhatsapp: d.whatsapp }
    : d;
  const saved = await writeProspectFields(supabase, dealId, fields);
  if (saved.error) return { ok: false, error: `Negócio criado, mas a prospecção não foi salva: ${saved.error}` };
  await syncNextAction(supabase, dealId);
  refresh();
  return { ok: true, message: "Lead cadastrado na cadência.", id: dealId };
}

/** Edita os campos de prospecção de um lead existente (seção Prospecção do negócio). */
export async function saveProspectFieldsAction(dealId: string, values: ProspectFieldsValues): Promise<Result> {
  const profile = await getCurrentProfile();
  if (!profile || !hasCapability(profile, "crm")) return UNAUTHORIZED;
  const parsed = prospectFieldsSchema.safeParse(values);
  if (!z.string().uuid().safeParse(dealId).success || !parsed.success) {
    return { ok: false, error: parsed.error?.issues[0]?.message ?? "Lead inválido." };
  }
  const supabase = await createClient();
  const saved = await writeProspectFields(supabase, dealId, parsed.data);
  if (saved.error) return { ok: false, error: saved.error };
  await syncNextAction(supabase, dealId);
  refresh();
  return { ok: true, message: "Prospecção salva." };
}
