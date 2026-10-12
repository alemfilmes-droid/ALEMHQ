"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { busySourcesOf, meetingHost, profileHost, resolveMeetingHost, type ResolvedHost } from "@/features/prospeccao/busy-sources";
import { loadCadenceContext } from "@/features/prospeccao/cadence-queries";
import { loadMessageInput } from "@/features/prospeccao/message-queries";
import { meetingWindowSchema } from "@/features/prospeccao/schemas";
import { publicEnv } from "@/lib/env";
import { hasCapability } from "@/lib/auth/permissions";
import { getCurrentProfile } from "@/lib/auth/session";
import { googleConfigured, syncGoogleForProfiles } from "@/lib/google/calendar.server";
import { collectBusy } from "@/lib/prospeccao/busy";
import { recipientPhone } from "@/lib/prospeccao/message";
import { normalizeWhatsapp } from "@/lib/prospeccao/phone";
import { renderScript } from "@/lib/prospeccao/render";
import { MEETING_HOST_CHOICES, type MeetingHostChoice } from "@/lib/prospeccao/meeting-host";
import { formatSlot, insideWindows, isFree, suggestSlots, type Interval, type SlotRules } from "@/lib/prospeccao/slots";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

/**
 * Marcar reunião (spec 7.1 + Bloco 5): a pessoa escolhe quem atende — o Anderson ou o SDR (kick-off).
 * Horários livres reais da agenda de quem atende, frase pronta para o cliente, evento com o resumo do
 * lead e "Reunião aconteceu?". O HQ é a fonte da verdade: remarcar e cancelar é por aqui, e o espelho
 * leva ao Google de quem atende (do SDR, só se estiver conectado).
 */

type Supabase = Awaited<ReturnType<typeof createClient>>;

export interface SuggestedSlot extends Interval {
  label: string;
}

export type SuggestResult =
  | {
      ok: true;
      slots: SuggestedSlot[];
      offerText: string;
      /** Falta algo para a frase (ex.: nome do decisor) — dá para copiar mesmo assim, mas avisa. */
      offerWarning: string | null;
      recipient: string | null;
      durationMinutes: number;
      hostName: string;
      /** O Google de quem atende está conectado (sem ele, não há link do Meet). */
      hostGoogle: boolean;
    }
  | { ok: false; error: string; needsQualification?: boolean };

export type ConfirmResult = { ok: true; message: string } | { ok: false; error: string; slots?: SuggestedSlot[]; outsideWindows?: boolean };

const idSchema = z.string().uuid();
const SEARCH_DAYS = 20;

async function actor(): Promise<Supabase | null> {
  const profile = await getCurrentProfile();
  return profile && hasCapability(profile, "prospectActions") ? createClient() : null;
}

function refresh() {
  revalidatePath("/crm");
  revalidatePath("/agenda");
}

async function slotRules(supabase: Supabase): Promise<SlotRules> {
  const [context, settings] = await Promise.all([
    loadCadenceContext(supabase),
    supabase.from("prospect_settings").select("meeting_duration_minutes, meeting_windows").eq("id", true).maybeSingle(),
  ]);
  const windows = meetingWindowSchema.array().safeParse(settings.data?.meeting_windows);
  return {
    durationMinutes: settings.data?.meeting_duration_minutes ?? 45,
    windows: windows.success ? windows.data : [],
    calendar: context.calendar,
  };
}

async function busyFor(host: ResolvedHost, now: Date) {
  return collectBusy(busySourcesOf(host), now, new Date(now.getTime() + SEARCH_DAYS * 86_400_000));
}

const choiceSchema = z.enum(MEETING_HOST_CHOICES, { message: "Escolha com quem é a reunião." });

/** Nomes para a escolha "Reunião com Anderson" / "Reunião com Paulo (kick-off)". */
export async function meetingHostOptionsAction(dealId: string): Promise<{ ceo: string | null; sdr: string | null }> {
  if (!(await actor()) || !idSchema.safeParse(dealId).success) return { ceo: null, sdr: null };
  const [ceo, sdr] = await Promise.all([meetingHost(), resolveMeetingHost("sdr", dealId)]);
  return { ceo: ceo?.name ?? null, sdr: sdr.ok ? sdr.host.name : null };
}

/** Reagendar: quem atende continua o mesmo. */
async function meetingAttendeeHost(meetingId: string): Promise<ResolvedHost | null> {
  const { data } = await createAdminClient().from("deal_meetings").select("attendee_id").eq("id", meetingId).maybeSingle();
  return data?.attendee_id ? profileHost(data.attendee_id) : null;
}

const withLabels = (slots: Interval[]): SuggestedSlot[] => slots.map((slot) => ({ ...slot, label: formatSlot(slot.start) }));

/** Dois horários livres de quem atende + a frase da oferta pronta. `meetingId`: reagendar (mesmo anfitrião). */
export async function suggestMeetingAction(dealId: string, choice: MeetingHostChoice | null, meetingId?: string): Promise<SuggestResult> {
  const supabase = await actor();
  if (!supabase) return { ok: false, error: "Só o squad comercial marca reuniões da prospecção." };
  if (!idSchema.safeParse(dealId).success) return { ok: false, error: "Lead inválido." };
  const resolved = await hostFor(dealId, choice, meetingId);
  if (!resolved.ok) return resolved;
  const host = resolved.host;

  const { data: qualified } = await supabase.rpc("crm_deal_qualified", { p_deal_id: dealId });
  if (!qualified) return { ok: false, error: "Qualifique o lead antes de marcar a reunião (orçamento, tipo de projeto, prazo e decisor).", needsQualification: true };

  const now = new Date();
  const [rules, busy, loaded, script] = await Promise.all([
    slotRules(supabase),
    busyFor(host, now),
    loadMessageInput(supabase, dealId, now),
    supabase.from("prospect_scripts").select("body").eq("kind", "oferta_reuniao").maybeSingle(),
  ]);
  if (!busy.ok) return busy;
  const slots = withLabels(suggestSlots(now, busy.busy, rules));
  if (slots.length === 0) return { ok: false, error: "Não achei horário livre nos próximos 10 dias úteis. Use \"Outro horário\"." };

  const lead = loaded?.input.lead;
  const offer = renderScript(script.data?.body ?? "", {
    now,
    decisionMakerName: lead?.contactIsDecisionMaker ? lead.decisionMakerName || lead.contactName : lead?.decisionMakerName,
    leadName: lead?.name,
    slots: slots.map((slot) => slot.start),
  });
  const phone = lead ? recipientPhone(lead, false).phone : null;
  const normalized = phone ? normalizeWhatsapp(phone) : null;
  return {
    ok: true,
    slots,
    offerText: offer.text,
    offerWarning: offer.missing.includes("nome") ? "Falta o nome do decisor na frase." : null,
    recipient: normalized?.ok ? normalized.number : null,
    durationMinutes: rules.durationMinutes,
    hostName: host.name,
    hostGoogle: host.googleConnected,
  };
}

/** Quem atende: a escolha feita ou, ao reagendar, quem já atende a reunião. */
async function hostFor(dealId: string, choice: MeetingHostChoice | null, meetingId?: string): Promise<{ ok: true; host: ResolvedHost } | { ok: false; error: string }> {
  if (meetingId) {
    const host = idSchema.safeParse(meetingId).success ? await meetingAttendeeHost(meetingId) : null;
    return host ? { ok: true, host } : { ok: false, error: "Reunião não encontrada." };
  }
  const parsed = choiceSchema.safeParse(choice);
  if (!parsed.success) return { ok: false, error: "Escolha com quem é a reunião." };
  return resolveMeetingHost(parsed.data, dealId);
}

/** "Outro horário": está livre e dentro das janelas? (avisa, não bloqueia) */
export async function checkSlotAction(
  startIso: string,
  dealId: string,
  choice: MeetingHostChoice | null,
  meetingId?: string,
): Promise<{ ok: true; free: boolean; insideWindows: boolean } | { ok: false; error: string }> {
  const supabase = await actor();
  if (!supabase) return { ok: false, error: "Só o squad comercial marca reuniões da prospecção." };
  if (Number.isNaN(Date.parse(startIso)) || !idSchema.safeParse(dealId).success) return { ok: false, error: "Escolha data e hora." };
  const resolved = await hostFor(dealId, choice, meetingId);
  if (!resolved.ok) return resolved;
  const rules = await slotRules(supabase);
  const slot = { start: new Date(startIso).toISOString(), end: new Date(Date.parse(startIso) + rules.durationMinutes * 60_000).toISOString() };
  const busy = await busyFor(resolved.host, new Date(Date.parse(slot.start) - 86_400_000));
  if (!busy.ok) return busy;
  return { ok: true, free: isFree(slot, busy.busy), insideWindows: insideWindows(slot, rules) };
}

/** Resumo do lead na descrição do evento (sem dados de contato do cliente além do decisor). */
async function eventNotes(supabase: Supabase, dealId: string): Promise<{ title: string; notes: string }> {
  const [loaded, objections] = await Promise.all([
    loadMessageInput(supabase, dealId),
    supabase.from("prospect_lead_objections").select("created_at, objection:prospect_objections(label)").eq("deal_id", dealId).order("created_at"),
  ]);
  const lead = loaded?.input.lead;
  const playbook = loaded?.cadence.playbook.name ?? "";
  const decisor = lead?.contactIsDecisionMaker ? lead.decisionMakerName || lead.contactName : lead?.decisionMakerName;
  const role = loaded?.cadence.lead.prospect_decision_maker_role;
  const objectionLines = (objections.data ?? []).map((row) => `- ${row.objection?.label ?? "Objeção"} (${new Date(row.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" })})`);
  const notes = [
    `Lead: ${lead?.name ?? ""}`,
    `Decisor: ${[decisor, role].filter(Boolean).join(" · ") || "—"}`,
    `Playbook: ${playbook}`,
    lead?.hook ? `Gancho: ${lead.hook}` : null,
    objectionLines.length ? `Objeções:\n${objectionLines.join("\n")}` : "Objeções: nenhuma registrada",
    `Card no CRM: ${publicEnv.NEXT_PUBLIC_SITE_URL}/crm?aba=leads&negocio=${dealId}`,
  ]
    .filter(Boolean)
    .join("\n");
  return { title: `Reunião · ${lead?.name ?? "Lead"} · ${playbook}`, notes };
}

/** Confere a agenda de novo logo antes de gravar; horário tomado devolve sugestões novas. */
async function recheck(supabase: Supabase, host: ResolvedHost, startIso: string, override: boolean): Promise<ConfirmResult | { ok: true; start: string; duration: number }> {
  const rules = await slotRules(supabase);
  const now = new Date();
  const slot = { start: new Date(startIso).toISOString(), end: new Date(Date.parse(startIso) + rules.durationMinutes * 60_000).toISOString() };
  if (Date.parse(slot.start) <= now.getTime()) return { ok: false, error: "Escolha um horário no futuro." };
  const busy = await busyFor(host, now);
  if (!busy.ok) return busy;
  if (!override && !isFree(slot, busy.busy)) {
    return { ok: false, error: `Esse horário acabou de ser ocupado na agenda de ${host.name}. Veja as novas sugestões.`, slots: withLabels(suggestSlots(now, busy.busy, rules)) };
  }
  if (!override && !insideWindows(slot, rules)) return { ok: false, error: "Esse horário está fora das janelas de reunião.", outsideWindows: true };
  return { ok: true, start: slot.start, duration: rules.durationMinutes };
}

/**
 * Espelha na hora no Google de quem atende (se conectado). Se o Google falhar (a sincronização grava o
 * erro na conta), a reunião fica no HQ e o Google atualiza na próxima rodada — nunca trava o CRM.
 */
async function syncHost(host: ResolvedHost): Promise<string> {
  if (!host.googleConnected) return "";
  if (!googleConfigured()) return " O Google Agenda atualiza na próxima sincronização (até 15 min).";
  await syncGoogleForProfiles([host.id]).catch(() => undefined);
  const { data } = await createAdminClient().from("google_accounts").select("last_error").eq("profile_id", host.id).maybeSingle();
  return data?.last_error ? " Não consegui atualizar o Google agora; ele atualiza na próxima sincronização." : "";
}

const confirmSchema = z.object({ startIso: z.string().refine((value) => !Number.isNaN(Date.parse(value))), meet: z.boolean(), override: z.boolean() });

export async function confirmMeetingAction(dealId: string, choice: MeetingHostChoice | null, input: z.input<typeof confirmSchema>): Promise<ConfirmResult> {
  const supabase = await actor();
  if (!supabase) return { ok: false, error: "Só o squad comercial marca reuniões da prospecção." };
  const parsed = confirmSchema.safeParse(input);
  if (!idSchema.safeParse(dealId).success || !parsed.success) return { ok: false, error: "Escolha um horário." };
  const resolved = await hostFor(dealId, choice);
  if (!resolved.ok) return resolved;
  const host = resolved.host;

  const checked = await recheck(supabase, host, parsed.data.startIso, parsed.data.override);
  if (!checked.ok || !("start" in checked)) return checked;
  const { title, notes } = await eventNotes(supabase, dealId);
  const { error } = await supabase.rpc("prospect_schedule_meeting", {
    p_deal_id: dealId,
    p_starts_at: checked.start,
    p_duration_minutes: checked.duration,
    p_attendee_id: host.id,
    p_title: title,
    p_notes: notes,
    p_meet: parsed.data.meet,
  });
  if (error) return { ok: false, error: ["23514", "42501", "22023"].includes(error.code ?? "") ? error.message : "Não foi possível marcar a reunião." };
  const syncNote = await syncHost(host);
  refresh();
  return { ok: true, message: `Reunião com ${host.name.split(" ")[0]} marcada para ${formatSlot(checked.start)}.${syncNote}` };
}

export async function rescheduleMeetingAction(meetingId: string, input: z.input<typeof confirmSchema>): Promise<ConfirmResult> {
  const supabase = await actor();
  if (!supabase) return { ok: false, error: "Só o squad comercial remarca reuniões da prospecção." };
  const parsed = confirmSchema.safeParse(input);
  if (!idSchema.safeParse(meetingId).success || !parsed.success) return { ok: false, error: "Escolha um horário." };
  const host = await meetingAttendeeHost(meetingId);
  if (!host) return { ok: false, error: "Reunião não encontrada." };

  const checked = await recheck(supabase, host, parsed.data.startIso, parsed.data.override);
  if (!checked.ok || !("start" in checked)) return checked;
  const { error } = await supabase.rpc("prospect_reschedule_meeting", { p_meeting_id: meetingId, p_starts_at: checked.start, p_meet: parsed.data.meet });
  if (error) return { ok: false, error: ["23514", "42501"].includes(error.code ?? "") ? error.message : "Não foi possível remarcar." };
  const syncNote = await syncHost(host);
  refresh();
  return { ok: true, message: `Reunião remarcada para ${formatSlot(checked.start)}.${syncNote}` };
}

export async function cancelMeetingAction(meetingId: string, reason: string): Promise<ActionResult> {
  const supabase = await actor();
  if (!supabase) return { ok: false, error: "Só o squad comercial cancela reuniões da prospecção." };
  if (!idSchema.safeParse(meetingId).success || reason.trim().length < 2) return { ok: false, error: "Escreva o motivo do cancelamento." };
  const host = await meetingAttendeeHost(meetingId);
  const { error } = await supabase.rpc("prospect_cancel_meeting", { p_meeting_id: meetingId, p_reason: reason.trim() });
  if (error) return { ok: false, error: ["23514", "42501"].includes(error.code ?? "") ? error.message : "Não foi possível cancelar." };
  const syncNote = host ? await syncHost(host) : "";
  refresh();
  return { ok: true, message: `Reunião cancelada. O lead voltou para Em conversa.${syncNote}` };
}

/** "Reunião aconteceu?" — Sim cria (ou mostra) o rascunho em Orçamentos; Não compareceu volta para Em conversa. */
export async function meetingOutcomeAction(meetingId: string, held: boolean): Promise<ActionResult & { budgetId?: string }> {
  const supabase = await actor();
  if (!supabase) return { ok: false, error: "Só o squad comercial registra o resultado da reunião." };
  if (!idSchema.safeParse(meetingId).success) return { ok: false, error: "Reunião inválida." };
  const { data: budgetId, error } = await supabase.rpc("prospect_meeting_outcome", { p_meeting_id: meetingId, p_held: held, p_note: "" });
  if (error) return { ok: false, error: ["23514", "42501"].includes(error.code ?? "") ? error.message : "Não foi possível registrar." };
  refresh();
  revalidatePath("/orcamentos");
  return held
    ? { ok: true, message: "Reunião realizada. O rascunho do orçamento está em Orçamentos.", budgetId: budgetId ?? undefined }
    : { ok: true, message: "Registrado. O lead voltou para Em conversa — remarque quando ele responder." };
}
