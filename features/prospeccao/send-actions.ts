"use server";

import { z } from "zod";
import { recordTouchSentAction, type UndoableResult } from "@/features/prospeccao/cadence-actions";
import { loadMessageInput } from "@/features/prospeccao/message-queries";
import { parseEffectiveTime } from "@/lib/crm/effective-time";
import { buildMessage, type Message } from "@/lib/prospeccao/message";
import { hasCapability } from "@/lib/auth/permissions";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Enviar no WhatsApp (spec 6 e 9.1). O servidor monta a mensagem; o card abre o WhatsApp no clique
 * e guarda o texto final como rascunho (POST /api/prospeccao/rascunho, ver pending.ts); "Marcar
 * enviado" grava exatamente esse texto.
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;

export type PrepareResult = ({ ok: true } & Message & { pendingText: string | null }) | { ok: false; error: string };

const idSchema = z.string().uuid();

async function actor(): Promise<Supabase | null> {
  const profile = await getCurrentProfile();
  return profile && hasCapability(profile, "prospectActions") ? createClient() : null;
}

/** Monta a prévia do próximo toque. Com rascunho do mesmo toque, devolve o texto editado também. */
export async function prepareSendAction(dealId: string): Promise<PrepareResult> {
  const supabase = await actor();
  if (!supabase) return { ok: false, error: "Só o squad comercial envia mensagens da prospecção." };
  if (!idSchema.safeParse(dealId).success) return { ok: false, error: "Lead inválido." };
  const loaded = await loadMessageInput(supabase, dealId);
  if (!loaded) return { ok: false, error: "Lead fora da cadência." };
  const message = buildMessage(loaded.input);
  if (!message.ok) return message;

  const { data: pending } = await supabase.from("prospect_pending_sends").select("touch_number, script_kind, body").eq("deal_id", dealId).maybeSingle();
  const same = pending && pending.touch_number === message.touchNumber && pending.script_kind === message.scriptKind;
  return { ...message, pendingText: same ? pending.body : null };
}

/**
 * "Marcar enviado": grava o rascunho como o toque enviado (texto exato, com as edições). `occurred`
 * ("Fiz em outro horário") vira o horário efetivo do toque — a cadência conta dali.
 */
export async function markSentAction(dealId: string, occurred: { date: string; time: string } | null = null): Promise<UndoableResult> {
  const supabase = await actor();
  if (!supabase) return { ok: false, error: "Só o squad comercial marca envios da prospecção." };
  if (!idSchema.safeParse(dealId).success) return { ok: false, error: "Lead inválido." };
  const effective = occurred ? parseEffectiveTime(occurred.date, occurred.time, new Date()) : null;
  if (effective && !effective.ok) return { ok: false, error: effective.error };
  const { data: pending } = await supabase.from("prospect_pending_sends").select("touch_number, script_kind, body").eq("deal_id", dealId).maybeSingle();
  if (!pending) return { ok: false, error: "Abra o WhatsApp pelo HQ antes de marcar enviado." };

  const loaded = await loadMessageInput(supabase, dealId);
  const state = loaded?.cadence.state;
  const touchNumber = state?.isReactivation ? null : (state?.currentTouch ?? null);
  if (!state?.applicableScript || touchNumber !== pending.touch_number || state.applicableScript.kind !== pending.script_kind) {
    return { ok: false, error: "O toque mudou desde que o WhatsApp foi aberto. Abra a prévia de novo." };
  }
  return recordTouchSentAction(dealId, pending.body, effective?.iso ?? null);
}

export interface TouchHistoryItem {
  id: string;
  touchNumber: number | null;
  sentAt: string;
  text: string;
  sentBy: string | null;
  /** Abordagem riscada (excluída com motivo): aparece riscada e não conta. */
  struck: boolean;
  /** Enviado antes do último reinício ou edição da cadência: ciclo anterior (não conta no ciclo atual). */
  previousCycle: boolean;
}

/** Histórico de toques do card (carregado só quando a pessoa abre). */
export async function touchHistoryAction(dealId: string): Promise<TouchHistoryItem[]> {
  const profile = await getCurrentProfile();
  if (!profile || !hasCapability(profile, "crm") || !idSchema.safeParse(dealId).success) return [];
  const supabase = await createClient();
  const [{ data }, { data: deal }] = await Promise.all([
    supabase
      .from("prospect_touch_logs")
      .select("id, touch_number, sent_at, deleted_at, rendered_text, sender:profiles!prospect_touch_logs_sent_by_fkey(full_name)")
      .eq("deal_id", dealId)
      .order("sent_at", { ascending: false }),
    supabase.from("deals").select("prospect_cadence_restarted_at, prospect_override_at").eq("id", dealId).maybeSingle(),
  ]);
  const cycleStart = [deal?.prospect_cadence_restarted_at, deal?.prospect_override_at].filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  return (data ?? []).map((row) => ({
    id: row.id,
    touchNumber: row.touch_number,
    sentAt: row.sent_at,
    text: row.rendered_text,
    sentBy: row.sender?.full_name ?? null,
    struck: row.deleted_at !== null,
    previousCycle: cycleStart !== null && row.sent_at < cycleStart,
  }));
}
