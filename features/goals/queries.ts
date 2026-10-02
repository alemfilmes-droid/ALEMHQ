import "server-only";
import { toCents } from "@/features/finance/money";
import type { GoalEntryItem, GoalItem, GoalTab, PaymentDetailsItem } from "@/features/goals/types";
import { createClient } from "@/lib/supabase/server";
import type { GoalWithProgress, PaymentDetails } from "@/types";

const OPEN_STATUSES = ["ativa", "em_revisao"] as const;
const CLOSED_STATUSES = ["aprovada", "cancelada"] as const;

function toGoalItem(row: GoalWithProgress): GoalItem {
  const mode = row.commission_mode ?? "percentual";
  return {
    id: row.id ?? "",
    title: row.title ?? "",
    description: row.description,
    ownerId: row.owner_id ?? "",
    ownerName: row.owner_name ?? "—",
    ownerAvatarUrl: row.owner_avatar_url,
    metric: row.metric ?? "personalizada",
    unitLabel: row.unit_label,
    isMoney: row.is_money ?? false,
    target: toCents(row.target_value),
    startsOn: row.starts_on ?? "",
    endsOn: row.ends_on ?? "",
    commissionMode: mode,
    commissionRate: mode === "percentual" ? Number(row.commission_rate ?? 0) : toCents(row.commission_rate),
    minAchievementPct: Number(row.min_achievement_pct ?? 0),
    autoFromCrm: row.auto_from_crm ?? false,
    status: row.status ?? "ativa",
    approved: toCents(row.approved_value),
    pending: toCents(row.pending_value),
    pendingCount: row.pending_count ?? 0,
    commissionConfirmed: toCents(row.commission_confirmed),
    commissionPotential: toCents(row.commission_potential),
    approvedAt: row.approved_at,
    finalAchieved: row.final_achieved == null ? null : toCents(row.final_achieved),
    finalCommission: row.final_commission == null ? null : toCents(row.final_commission),
    payableId: row.payable_id,
  };
}

/**
 * Metas visíveis para a pessoa: a RLS devolve as dela, ou todas para a diretoria. `ownerId` limita
 * a uma pessoa (cards de Início/Avisos).
 */
export async function listGoals(tab: GoalTab, ownerId?: string): Promise<GoalItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("goals_with_progress")
    .select("*")
    .in("status", tab === "ativas" ? [...OPEN_STATUSES] : [...CLOSED_STATUSES])
    .order(tab === "ativas" ? "ends_on" : "updated_at", { ascending: tab === "ativas" });
  if (ownerId) query = query.eq("owner_id", ownerId);
  if (tab === "encerradas") query = query.limit(100);
  const { data, error } = await query;
  if (error) throw new Error("Falha ao carregar as metas.");
  return (data ?? []).map(toGoalItem);
}

/** Metas ativas de uma pessoa — card em destaque de Início e Avisos. Nunca derruba a página. */
export async function getMyActiveGoals(profileId: string): Promise<GoalItem[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("goals_with_progress")
      .select("*")
      .eq("owner_id", profileId)
      .eq("status", "ativa")
      .order("ends_on", { ascending: true });
    if (error) return [];
    return (data ?? []).map(toGoalItem);
  } catch {
    return [];
  }
}

export async function getGoal(id: string): Promise<GoalItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("goals_with_progress").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("Falha ao carregar a meta.");
  return data ? toGoalItem(data) : null;
}

export async function listGoalEntries(goalId: string): Promise<GoalEntryItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goal_entries")
    .select(
      "*, reviewer:profiles!goal_entries_reviewed_by_fkey(full_name), author:profiles!goal_entries_created_by_fkey(full_name)",
    )
    .eq("goal_id", goalId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error("Falha ao carregar os lançamentos.");
  return (data ?? []).map((row) => ({
    id: row.id,
    goalId: row.goal_id,
    amount: toCents(row.amount),
    entryDate: row.entry_date,
    note: row.note,
    linkUrl: row.link_url,
    dealId: row.deal_id,
    source: row.source,
    status: row.status,
    reviewNote: row.review_note,
    reviewedAt: row.reviewed_at,
    reviewerName: row.reviewer?.full_name ?? null,
    createdByName: row.author?.full_name ?? null,
    createdAt: row.created_at,
  }));
}

/** Diretoria: quantas metas esperam revisão (lançamentos pendentes ou período encerrado). */
export async function getGoalsReviewSummary(): Promise<{ active: number; awaiting: number; pendingEntries: number }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("goals_with_progress").select("status, pending_count").in("status", [...OPEN_STATUSES]);
    if (error) return { active: 0, awaiting: 0, pendingEntries: 0 };
    const rows = data ?? [];
    return {
      active: rows.filter((row) => row.status === "ativa").length,
      awaiting: rows.filter((row) => row.status === "em_revisao" || (row.pending_count ?? 0) > 0).length,
      pendingEntries: rows.reduce((total, row) => total + (row.pending_count ?? 0), 0),
    };
  } catch {
    return { active: 0, awaiting: 0, pendingEntries: 0 };
  }
}

export async function listGoalOwnerOptions(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, full_name").eq("is_active", true).neq("full_name", "").order("full_name");
  return (data ?? []).map((row) => ({ id: row.id, name: row.full_name }));
}

export function toPaymentDetailsItem(row: PaymentDetails): PaymentDetailsItem {
  return {
    preferredMethod: row.preferred_method,
    holderName: row.holder_name,
    holderDocument: row.holder_document,
    pixKeyType: row.pix_key_type,
    pixKey: row.pix_key,
    bankName: row.bank_name,
    bankCode: row.bank_code,
    agency: row.agency,
    accountNumber: row.account_number,
    accountType: row.account_type,
    notes: row.notes,
    updatedAt: row.updated_at,
  };
}

/** Dados de pagamento de uma pessoa: a própria ou quem tem acesso ao financeiro (RLS). */
export async function getPaymentDetails(profileId: string): Promise<PaymentDetailsItem | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("payment_details").select("*").eq("profile_id", profileId).maybeSingle();
  return data ? toPaymentDetailsItem(data) : null;
}
