"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { loadCadenceContext, loadLeadCadences } from "@/features/prospeccao/cadence-queries";
import { syncNextAction } from "@/features/prospeccao/lead-fields";
import { PROSPECTING_PATH } from "@/features/prospeccao/labels";
import { canManageLeadCadence } from "@/lib/auth/permissions";
import { getCurrentProfile } from "@/lib/auth/session";
import { isDateOnly } from "@/lib/calendar";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

/**
 * "Gerenciar prospecção": CEO/admin e Head comercial. O SDR é barrado aqui e de novo no banco
 * (can_manage_lead_cadence em cada função). Cada ação fica em prospect_management_log.
 */

const FORBIDDEN: ActionResult = { ok: false, error: "Só o CEO/admin e o Head comercial gerenciam a prospecção." };
const uuid = z.string().uuid();

const editSchema = z.object({
  dealId: uuid,
  playbookId: uuid,
  touch: z.number().int().min(0, "Escolha o toque.").max(20),
  due: z.string().refine(isDateOnly, "Escolha a data do próximo toque."),
});

async function manager() {
  const profile = await getCurrentProfile();
  return profile && canManageLeadCadence(profile) ? createClient() : null;
}

function refresh() {
  revalidatePath("/crm");
  revalidatePath(PROSPECTING_PATH);
  revalidatePath("/inicio");
}

function failure(error: { code?: string; message: string }, fallback: string): ActionResult {
  return { ok: false, error: ["23514", "42501", "22023"].includes(error.code ?? "") ? error.message : fallback };
}

export async function editCadenceAction(values: z.input<typeof editSchema>): Promise<ActionResult> {
  const supabase = await manager();
  if (!supabase) return FORBIDDEN;
  const parsed = editSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os campos." };
  const d = parsed.data;
  const { error } = await supabase.rpc("prospect_manage_edit", { p_deal_id: d.dealId, p_playbook_id: d.playbookId, p_touch: d.touch, p_due: d.due });
  if (error) return failure(error, "Não foi possível editar a cadência.");
  await syncNextAction(supabase, d.dealId);
  refresh();
  return { ok: true, message: "Cadência atualizada." };
}

export async function restartCadenceAction(dealId: string, playbookId: string): Promise<ActionResult> {
  const supabase = await manager();
  if (!supabase) return FORBIDDEN;
  if (!uuid.safeParse(dealId).success || !uuid.safeParse(playbookId).success) return { ok: false, error: "Escolha o playbook." };
  const { error } = await supabase.rpc("prospect_manage_restart", { p_deal_id: dealId, p_playbook_id: playbookId });
  if (error) return failure(error, "Não foi possível reiniciar a cadência.");
  await syncNextAction(supabase, dealId);
  refresh();
  return { ok: true, message: "Cadência reiniciada." };
}

export async function removeFromProspectingAction(dealId: string): Promise<ActionResult> {
  const supabase = await manager();
  if (!supabase) return FORBIDDEN;
  if (!uuid.safeParse(dealId).success) return { ok: false, error: "Lead inválido." };
  const { error } = await supabase.rpc("prospect_manage_remove", { p_deal_id: dealId });
  if (error) return failure(error, "Não foi possível remover o lead da prospecção.");
  refresh();
  return { ok: true, message: "Lead removido da prospecção. O negócio continua no CRM." };
}

export async function eraseProspectingAction(dealId: string, confirmName: string): Promise<ActionResult> {
  const supabase = await manager();
  if (!supabase) return FORBIDDEN;
  if (!uuid.safeParse(dealId).success || confirmName.length > 200) return { ok: false, error: "Lead inválido." };
  const { data, error } = await supabase.rpc("prospect_manage_erase", { p_deal_id: dealId, p_confirm_name: confirmName });
  if (error || !data) return failure(error ?? { message: "" }, "Não foi possível apagar a prospecção. Nada foi alterado.");
  const counts = data as { touches: number };
  refresh();
  return { ok: true, message: `Prospecção apagada (${counts.touches} ${counts.touches === 1 ? "toque" : "toques"}). O negócio continua no CRM.` };
}

export interface ManageOptions {
  leadName: string;
  /** Já entrou na cadência alguma vez (tem ou teve). */
  hadCadence: boolean;
  /** Está na cadência agora (não removido). */
  inCadence: boolean;
  removedAt: string | null;
  playbooks: { id: string; name: string; touches: number }[];
  current: { playbookId: string | null; touch: number | null; nextDue: string | null };
  today: string;
}

/** Opções da janela de gestão, carregadas ao abrir o menu (só para quem pode gerenciar). */
export async function manageOptionsAction(dealId: string): Promise<ManageOptions | null> {
  const supabase = await manager();
  if (!supabase || !uuid.safeParse(dealId).success) return null;
  const [deal, context, cadences, active] = await Promise.all([
    supabase.from("deals").select("prospect_playbook_id, prospect_cadence_started_at, prospect_removed_at, company:companies(name)").eq("id", dealId).maybeSingle(),
    loadCadenceContext(supabase),
    loadLeadCadences(supabase, dealId),
    supabase.from("prospect_playbooks").select("id").eq("active", true).order("position"),
  ]);
  if (!deal.data) return null;
  const { count } = await supabase.from("prospect_touch_logs").select("id", { count: "exact", head: true }).eq("deal_id", dealId);
  const state = cadences.get(dealId)?.state ?? null;
  const started = deal.data.prospect_cadence_started_at !== null;
  return {
    leadName: deal.data.company?.name ?? "",
    hadCadence: started || (count ?? 0) > 0,
    inCadence: started && deal.data.prospect_removed_at === null,
    removedAt: deal.data.prospect_removed_at,
    playbooks: (active.data ?? []).flatMap((row) => {
      const playbook = context.playbooks.get(row.id);
      return playbook ? [{ id: playbook.id, name: playbook.name, touches: playbook.rules.offsets.length }] : [];
    }),
    current: { playbookId: deal.data.prospect_playbook_id, touch: state?.currentTouch ?? null, nextDue: state?.nextDueDate ?? null },
    today: context.today,
  };
}
