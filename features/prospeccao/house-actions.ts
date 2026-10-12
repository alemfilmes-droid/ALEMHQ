"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasCapability } from "@/lib/auth/permissions";
import { getCurrentProfile } from "@/lib/auth/session";
import { houseOptions } from "@/lib/prospeccao/house-client";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

const idSchema = z.string().uuid();

/** Cliente da casa: troca para a outra sugestão de playbook, só antes do primeiro envio. */
export async function switchHousePlaybookAction(dealId: string, playbookId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile || !hasCapability(profile, "prospectActions")) return { ok: false, error: "Só o squad comercial muda o playbook." };
  if (!idSchema.safeParse(dealId).success || !idSchema.safeParse(playbookId).success) return { ok: false, error: "Playbook inválido." };
  const supabase = await createClient();

  const [deal, sent, playbooks, suggestions] = await Promise.all([
    supabase.from("deals").select("prospect_house_return_on, prospect_origin_deal_id, prospect_lead_type").eq("id", dealId).maybeSingle(),
    supabase.from("prospect_touch_logs").select("id", { count: "exact", head: true }).eq("deal_id", dealId),
    supabase.from("prospect_playbooks").select("id, name, audience, active, uses_house_client_script, position, suggested_goal_id"),
    supabase.from("prospect_house_suggestions").select("closed_playbook_id, suggested_playbook_id, position"),
  ]);
  if (!deal.data?.prospect_house_return_on) return { ok: false, error: "Este lead não é cliente da casa." };
  if ((sent.count ?? 0) > 0) return { ok: false, error: "O primeiro toque já foi enviado: o playbook não muda mais." };

  const { data: origin } = deal.data.prospect_origin_deal_id
    ? await supabase.from("deals").select("prospect_playbook_id").eq("id", deal.data.prospect_origin_deal_id).maybeSingle()
    : { data: null };
  const rows = playbooks.data ?? [];
  const allowed = houseOptions(
    origin?.prospect_playbook_id ?? null,
    (suggestions.data ?? []).map((row) => ({ closedPlaybookId: row.closed_playbook_id, suggestedPlaybookId: row.suggested_playbook_id, position: row.position })),
    rows.map((row) => ({ id: row.id, audience: row.audience, active: row.active, usesHouseClientScript: row.uses_house_client_script, position: row.position })),
    deal.data.prospect_lead_type ?? "escola",
  );
  const chosen = rows.find((row) => row.id === playbookId);
  if (!chosen || !allowed.includes(playbookId)) return { ok: false, error: "Esse playbook não está entre as sugestões para este cliente." };

  const { error } = await supabase
    .from("deals")
    .update({ prospect_playbook_id: chosen.id, prospect_goal_id: chosen.suggested_goal_id })
    .eq("id", dealId);
  if (error) return { ok: false, error: "Não foi possível trocar o playbook." };
  revalidatePath("/crm");
  return { ok: true, message: `Playbook trocado para ${chosen.name}.` };
}
