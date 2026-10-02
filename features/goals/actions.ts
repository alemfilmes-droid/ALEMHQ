"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { centsToNumber } from "@/features/finance/money";
import { getPaymentDetails } from "@/features/goals/queries";
import {
  entrySchema,
  goalSchema,
  parseHundredths,
  paymentDetailsSchema,
  type EntryValues,
  type GoalValues,
  type PaymentDetailsValues,
} from "@/features/goals/schemas";
import type { PaymentDetailsItem } from "@/features/goals/types";
import { hasCapability } from "@/lib/auth/permissions";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, GoalEntryStatus, Tables } from "@/types";

const UNAUTHENTICATED = { ok: false, error: "Sessão expirada. Entre novamente." } as const;
const FORBIDDEN = { ok: false, error: "Só a diretoria gerencia metas." } as const;
const INVALID = { ok: false, error: "Revise os campos e tente novamente." } as const;

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function refresh(goalId?: string) {
  revalidatePath("/metas");
  if (goalId) revalidatePath(`/metas/${goalId}`);
  revalidatePath("/inicio");
  revalidatePath("/avisos");
}

/** Mensagem do banco (raise exception) quando é uma regra de negócio; senão, a genérica. */
function dbError(error: { code?: string; message: string }, fallback: string): string {
  return error.code === "42501" || error.code === "22023" || error.code === "P0002" ? error.message : fallback;
}

function hundredthsToNumber(text: string): number {
  return centsToNumber(parseHundredths(text) ?? 0);
}

async function requireManager() {
  const profile = await getCurrentProfile();
  if (!profile) return { profile: null, error: UNAUTHENTICATED } as const;
  if (!hasCapability(profile, "manageCompany")) return { profile: null, error: FORBIDDEN } as const;
  return { profile, error: null } as const;
}

function goalRow(values: GoalValues) {
  return {
    title: values.title,
    description: values.description || null,
    owner_id: values.ownerId,
    metric: values.metric,
    unit_label: values.metric === "personalizada" ? values.unitLabel || null : null,
    is_money: values.metric === "vendas_valor" || (values.metric === "personalizada" && values.isMoney),
    target_value: hundredthsToNumber(values.target),
    starts_on: values.startsOn,
    ends_on: values.endsOn,
    commission_mode: values.commissionMode,
    commission_rate: hundredthsToNumber(values.commissionRate || "0"),
    fallback_rate: hundredthsToNumber(values.fallbackRate || "0"),
    min_achievement_pct: hundredthsToNumber(values.minAchievementPct || "0"),
    auto_from_crm: values.metric !== "personalizada" && values.autoFromCrm,
  } satisfies Tables["goals"]["Update"];
}

export async function saveGoalAction(values: GoalValues, id?: string): Promise<ActionResult & { id?: string }> {
  const { error: authError } = await requireManager();
  if (authError) return authError;
  const parsed = goalSchema.safeParse(values);
  if (!parsed.success || (id && !uuid.safeParse(id).success)) return INVALID;

  const supabase = await createClient();
  const row = goalRow(parsed.data);
  const result = id
    ? await supabase.from("goals").update(row).eq("id", id).select("id").single()
    : await supabase.from("goals").insert(row).select("id").single();
  if (result.error) return { ok: false, error: dbError(result.error, "Não foi possível salvar a meta.") };
  refresh(result.data.id);
  return { ok: true, message: id ? "Meta atualizada." : "Meta criada. O responsável já foi avisado.", id: result.data.id };
}

export async function setGoalStatusAction(id: string, status: "ativa" | "em_revisao" | "cancelada"): Promise<ActionResult> {
  const { error: authError } = await requireManager();
  if (authError) return authError;
  if (!uuid.safeParse(id).success) return INVALID;

  const supabase = await createClient();
  const { error } = await supabase.from("goals").update({ status }).eq("id", id);
  if (error) return { ok: false, error: dbError(error, "Não foi possível atualizar a meta.") };
  refresh(id);
  const messages = { ativa: "Meta reaberta.", em_revisao: "Meta encerrada para revisão.", cancelada: "Meta cancelada." };
  return { ok: true, message: messages[status] };
}

export async function deleteGoalAction(id: string): Promise<ActionResult> {
  const { error: authError } = await requireManager();
  if (authError) return authError;
  if (!uuid.safeParse(id).success) return INVALID;

  const supabase = await createClient();
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) return { ok: false, error: dbError(error, "Não foi possível apagar a meta.") };
  refresh();
  return { ok: true, message: "Meta apagada." };
}

/** Fecha a meta e gera a conta a pagar da comissão (goal_approve no banco). */
export async function approveGoalAction(id: string, dueDate: string): Promise<ActionResult> {
  const { error: authError } = await requireManager();
  if (authError) return authError;
  if (!uuid.safeParse(id).success || !isoDate.safeParse(dueDate).success) return INVALID;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("goal_approve", { p_goal_id: id, p_due_date: dueDate });
  if (error) return { ok: false, error: dbError(error, "Não foi possível aprovar a meta.") };
  refresh(id);
  revalidatePath("/financeiro");
  return { ok: true, message: data ? "Meta aprovada. A comissão foi lançada no financeiro." : "Meta aprovada (sem comissão a pagar)." };
}

export async function syncGoalAction(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  if (!uuid.safeParse(id).success) return INVALID;

  const supabase = await createClient();
  const { error } = await supabase.rpc("goal_sync_crm", { p_goal_id: id });
  if (error) return { ok: false, error: dbError(error, "Não foi possível sincronizar com o CRM.") };
  refresh(id);
  return { ok: true, message: "Meta sincronizada com o CRM." };
}

// ---------------------------------------------------------------------------
// Lançamentos — permissão de verdade: RLS + goal_entries_guard no banco
// ---------------------------------------------------------------------------

function entryRow(values: EntryValues) {
  return {
    amount: hundredthsToNumber(values.amount),
    entry_date: values.entryDate,
    note: values.note || null,
    link_url: values.linkUrl || null,
  } satisfies Tables["goal_entries"]["Update"];
}

export async function saveEntryAction(goalId: string, values: EntryValues, entryId?: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  const parsed = entrySchema.safeParse(values);
  if (!parsed.success || !uuid.safeParse(goalId).success || (entryId && !uuid.safeParse(entryId).success)) return INVALID;

  const supabase = await createClient();
  const row = entryRow(parsed.data);
  // Lançado pela diretoria já entra aprovado; pelo responsável, a confirmar.
  const status: GoalEntryStatus = hasCapability(profile, "manageCompany") ? "aprovado" : "pendente";
  const { error } = entryId
    ? await supabase.from("goal_entries").update(row).eq("id", entryId).eq("goal_id", goalId)
    : await supabase.from("goal_entries").insert({ ...row, goal_id: goalId, status });
  if (error) return { ok: false, error: dbError(error, "Não foi possível salvar o lançamento.") };
  refresh(goalId);
  return { ok: true, message: entryId ? "Lançamento atualizado." : status === "aprovado" ? "Lançamento registrado." : "Lançamento enviado para revisão." };
}

export async function deleteEntryAction(goalId: string, entryId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  if (!uuid.safeParse(goalId).success || !uuid.safeParse(entryId).success) return INVALID;

  const supabase = await createClient();
  const { error, count } = await supabase.from("goal_entries").delete({ count: "exact" }).eq("id", entryId).eq("goal_id", goalId);
  if (error || !count) return { ok: false, error: "Não foi possível apagar o lançamento." };
  refresh(goalId);
  return { ok: true, message: "Lançamento apagado." };
}

/** Aprova/recusa um ou vários lançamentos. Só diretoria (o banco repete a regra). */
export async function reviewEntriesAction(
  goalId: string,
  entryIds: string[],
  status: Exclude<GoalEntryStatus, "pendente"> | "pendente",
  note?: string,
): Promise<ActionResult> {
  const { error: authError } = await requireManager();
  if (authError) return authError;
  if (!uuid.safeParse(goalId).success || entryIds.length === 0 || entryIds.length > 500 || !entryIds.every((id) => uuid.safeParse(id).success)) return INVALID;
  const reviewNote = (note ?? "").trim().slice(0, 500) || null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("goal_entries")
    .update({ status, review_note: status === "pendente" ? null : reviewNote })
    .eq("goal_id", goalId)
    .in("id", entryIds);
  if (error) return { ok: false, error: dbError(error, "Não foi possível revisar os lançamentos.") };
  refresh(goalId);
  const plural = entryIds.length > 1;
  const verb = status === "aprovado" ? "aprovado" : status === "recusado" ? "recusado" : "reaberto";
  return { ok: true, message: `${plural ? `${entryIds.length} lançamentos ${verb}s` : `Lançamento ${verb}`}.` };
}

// ---------------------------------------------------------------------------
// Dados de pagamento
// ---------------------------------------------------------------------------

export async function savePaymentDetailsAction(values: PaymentDetailsValues): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  const parsed = paymentDetailsSchema.safeParse(values);
  if (!parsed.success) return INVALID;
  const v = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("payment_details").upsert({
    profile_id: profile.id,
    preferred_method: v.preferredMethod,
    holder_name: v.holderName || null,
    holder_document: v.holderDocument || null,
    pix_key_type: v.pixKeyType || null,
    pix_key: v.pixKey || null,
    bank_name: v.bankName || null,
    bank_code: v.bankCode || null,
    agency: v.agency || null,
    account_number: v.accountNumber || null,
    account_type: v.accountType || null,
    notes: v.notes || null,
  });
  if (error) return { ok: false, error: "Não foi possível salvar os dados de pagamento." };
  revalidatePath("/perfil");
  return { ok: true, message: "Dados de pagamento salvos." };
}

/** Financeiro: dados de pagamento de quem vai receber. A RLS só devolve para quem tem acesso. */
export async function getPayeePaymentDetailsAction(profileId: string): Promise<{ ok: true; details: PaymentDetailsItem | null } | { ok: false; error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  if (!uuid.safeParse(profileId).success) return INVALID;
  if (profileId !== profile.id && !hasCapability(profile, "finance")) return { ok: false, error: "Sem acesso ao financeiro." };
  return { ok: true, details: await getPaymentDetails(profileId) };
}
