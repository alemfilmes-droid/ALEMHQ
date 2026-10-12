"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { loadLeadCadences, type LeadCadence } from "@/features/prospeccao/cadence-queries";
import { syncNextAction } from "@/features/prospeccao/lead-fields";
import { reasonSchema } from "@/features/prospeccao/lead-schemas";
import { isDateOnly } from "@/lib/calendar";
import { hasCapability } from "@/lib/auth/permissions";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

/** Sucesso traz o id para o "Desfazer" do aviso. */
export type UndoableResult = { ok: true; message: string; undoId: string } | { ok: false; error: string };

/**
 * Serviço da cadência (spec seção 3). O Módulo 3 só liga os botões do card a estas ações. Quem
 * envia é sempre o usuário da sessão; o toque e o script vêm do estado calculado, nunca do cliente.
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;

const UNAUTHORIZED = { ok: false, error: "Só o squad comercial age na prospecção." } as const;
const idSchema = z.string().uuid();

/** Squad comercial e master agem na cadência; os demais com acesso ao CRM só leem. */
async function crmClient(): Promise<Supabase | null> {
  const profile = await getCurrentProfile();
  return profile && hasCapability(profile, "prospectActions") ? createClient() : null;
}

function refresh() {
  revalidatePath("/crm");
  revalidatePath("/inicio");
}

/** O id do script que o estado manda usar (o texto já vem renderizado do Módulo 3). */
async function applicableScriptId(supabase: Supabase, cadence: LeadCadence): Promise<string | null> {
  const script = cadence.state.applicableScript;
  if (!script) return null;
  const audience = cadence.lead.prospect_lead_type ?? cadence.playbook.audience;
  let query = supabase.from("prospect_scripts").select("id").eq("kind", script.kind);
  if (script.kind === "toque_zero") query = query.is("playbook_id", null).eq("touch_zero_variant", cadence.playbook.touchZeroVariant);
  else if (script.kind === "sem_gancho" || script.kind === "cliente_da_casa") query = query.is("playbook_id", null).eq("audience", audience);
  else if (script.kind === "toque") query = query.eq("playbook_id", cadence.playbook.id).eq("touch_number", script.scriptTouchNumber ?? 1);
  else query = query.eq("playbook_id", cadence.playbook.id);
  const { data } = await query.maybeSingle();
  return data?.id ?? null;
}

/** "Marcar enviado": grava o toque, registra a tentativa no funil e o próximo toque passa a valer. */
export async function recordTouchSentAction(dealId: string, renderedText: string): Promise<UndoableResult> {
  const supabase = await crmClient();
  if (!supabase) return UNAUTHORIZED;
  const text = z.string().trim().min(1).max(4000).safeParse(renderedText);
  if (!idSchema.safeParse(dealId).success || !text.success) return { ok: false, error: "Mensagem inválida." };

  const cadence = (await loadLeadCadences(supabase, dealId)).get(dealId);
  const script = cadence?.state.applicableScript;
  if (!cadence || !script) return { ok: false, error: "Este lead não tem toque para enviar agora." };

  const { data: undoId, error } = await supabase.rpc("prospect_record_touch", {
    p_deal_id: dealId,
    p_touch_number: cadence.state.isReactivation ? null : cadence.state.currentTouch,
    p_script_kind: script.kind,
    p_script_id: await applicableScriptId(supabase, cadence),
    p_rendered_text: text.data,
  });
  if (error) return { ok: false, error: error.code === "23514" ? error.message : "Não foi possível registrar o toque." };
  await syncNextAction(supabase, dealId);
  refresh();
  return { ok: true, message: "Toque registrado.", undoId };
}

/** "Respondeu": a cadência para na hora e o lead vai para Em conversa. */
export async function markRespondedAction(dealId: string): Promise<UndoableResult> {
  const supabase = await crmClient();
  if (!supabase) return UNAUTHORIZED;
  if (!idSchema.safeParse(dealId).success) return { ok: false, error: "Lead inválido." };
  const { data: undoId, error } = await supabase.rpc("prospect_mark_responded", { p_deal_id: dealId });
  if (error) return { ok: false, error: "Não foi possível marcar a resposta." };
  refresh();
  return { ok: true, message: "Lead em conversa. A cadência parou.", undoId };
}

/** "Desfazer" do aviso: reverte por completo o último Marcar enviado / Respondeu (prospect_undo). */
export async function undoAction(undoId: string): Promise<ActionResult> {
  const supabase = await crmClient();
  if (!supabase) return UNAUTHORIZED;
  if (!idSchema.safeParse(undoId).success) return { ok: false, error: "Não dá mais para desfazer." };
  const { data, error } = await supabase.rpc("prospect_undo", { p_op_id: undoId });
  if (error) return { ok: false, error: ["23514", "42501"].includes(error.code ?? "") ? error.message : "Não foi possível desfazer." };
  refresh();
  return { ok: true, message: data === "toque" ? "Envio desfeito. O rascunho voltou." : "Resposta desfeita. A cadência voltou." };
}

const decisionMakerSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome do decisor.").max(120, "Use até 120 caracteres."),
  role: z.string().trim().max(80, "Use até 80 caracteres."),
  whatsapp: z.string().trim().max(20, "Use até 20 caracteres.").regex(/^[+()\d\s-]*$/, "Use apenas números, espaços, +, ( ) e -."),
});

/**
 * Cadastra o decisor: depois do Toque 0, o Toque 1 vence no mesmo dia útil. `restart` (objeção
 * /nao-sou-eu, "Reiniciar a cadência no Toque 1?") faz a cadência recomeçar do Toque 1 hoje.
 */
export async function setDecisionMakerAction(dealId: string, values: z.input<typeof decisionMakerSchema>, restart = false): Promise<ActionResult> {
  const supabase = await crmClient();
  if (!supabase) return UNAUTHORIZED;
  const parsed = decisionMakerSchema.safeParse(values);
  if (!idSchema.safeParse(dealId).success || !parsed.success) return { ok: false, error: parsed.error?.issues[0]?.message ?? "Lead inválido." };

  const { data: current } = await supabase.from("deals").select("prospect_decision_maker_set_at").eq("id", dealId).maybeSingle();
  if (!current) return { ok: false, error: "Lead não encontrado ou sem permissão." };
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("deals")
    .update({
      prospect_decision_maker_name: parsed.data.name,
      prospect_decision_maker_role: parsed.data.role || null,
      prospect_decision_maker_whatsapp: parsed.data.whatsapp || null,
      prospect_decision_maker_set_at: current.prospect_decision_maker_set_at ?? now,
      ...(restart ? { prospect_cadence_restarted_at: now, prospect_contact_is_decision_maker: false } : {}),
    })
    .eq("id", dealId);
  if (error) return { ok: false, error: "Não foi possível salvar o decisor." };
  await syncNextAction(supabase, dealId);
  refresh();
  return { ok: true, message: restart ? "Decisor salvo. A cadência recomeça no Toque 1." : "Decisor salvo." };
}

export async function pauseLeadAction(dealId: string, reason: string): Promise<ActionResult> {
  const supabase = await crmClient();
  if (!supabase) return UNAUTHORIZED;
  const parsed = reasonSchema.safeParse(reason);
  if (!idSchema.safeParse(dealId).success || !parsed.success) return { ok: false, error: parsed.error?.issues[0]?.message ?? "Lead inválido." };
  const { data, error } = await supabase
    .from("deals")
    .update({ prospect_paused_at: new Date().toISOString(), prospect_pause_reason: parsed.data })
    .eq("id", dealId)
    .not("prospect_playbook_id", "is", null)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "Não foi possível pausar o lead." };
  refresh();
  return { ok: true, message: "Lead pausado." };
}

/** Descartar vale só para a prospecção: o negócio continua no funil como está. */
export async function discardLeadAction(dealId: string, reason: string): Promise<ActionResult> {
  const supabase = await crmClient();
  if (!supabase) return UNAUTHORIZED;
  const parsed = reasonSchema.safeParse(reason);
  if (!idSchema.safeParse(dealId).success || !parsed.success) return { ok: false, error: parsed.error?.issues[0]?.message ?? "Lead inválido." };
  const { data, error } = await supabase
    .from("deals")
    .update({ prospect_discarded_at: new Date().toISOString(), prospect_discard_reason: parsed.data })
    .eq("id", dealId)
    .not("prospect_playbook_id", "is", null)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "Não foi possível descartar o lead." };
  refresh();
  return { ok: true, message: "Lead descartado da prospecção." };
}

/** Retomar um lead pausado: o toque pendente vence a partir de hoje. */
export async function resumeLeadAction(dealId: string): Promise<ActionResult> {
  const supabase = await crmClient();
  if (!supabase) return UNAUTHORIZED;
  if (!idSchema.safeParse(dealId).success) return { ok: false, error: "Lead inválido." };
  const { data, error } = await supabase
    .from("deals")
    .update({ prospect_paused_at: null, prospect_pause_reason: null, prospect_resumed_at: new Date().toISOString() })
    .eq("id", dealId)
    .not("prospect_paused_at", "is", null)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "Este lead não está pausado." };
  await syncNextAction(supabase, dealId);
  refresh();
  return { ok: true, message: "Lead retomado." };
}

/** Objeção com data ("sem verba", "me chama depois"): a reativação acontece nesse dia. Nulo remove. */
export async function setManualReactivationAction(dealId: string, date: string | null): Promise<ActionResult> {
  const supabase = await crmClient();
  if (!supabase) return UNAUTHORIZED;
  if (!idSchema.safeParse(dealId).success || (date !== null && !isDateOnly(date))) return { ok: false, error: "Escolha uma data válida." };
  const { data, error } = await supabase
    .from("deals")
    .update({ prospect_manual_reactivation_on: date })
    .eq("id", dealId)
    .not("prospect_playbook_id", "is", null)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "Não foi possível agendar a reativação." };
  await syncNextAction(supabase, dealId);
  refresh();
  return { ok: true, message: date ? "Reativação agendada." : "Reativação manual removida." };
}

/** Registra a objeção no lead, com o playbook atual (alimenta o relatório de objeções). */
export async function registerObjectionAction(dealId: string, objectionId: string): Promise<ActionResult> {
  const supabase = await crmClient();
  if (!supabase) return UNAUTHORIZED;
  if (!idSchema.safeParse(dealId).success || !idSchema.safeParse(objectionId).success) return { ok: false, error: "Objeção inválida." };
  const { data: deal } = await supabase.from("deals").select("prospect_playbook_id").eq("id", dealId).maybeSingle();
  if (!deal) return { ok: false, error: "Lead não encontrado ou sem permissão." };
  const { error } = await supabase
    .from("prospect_lead_objections")
    .insert({ deal_id: dealId, objection_id: objectionId, playbook_id: deal.prospect_playbook_id });
  if (error) return { ok: false, error: "Não foi possível registrar a objeção." };
  refresh();
  return { ok: true, message: "Objeção registrada." };
}
