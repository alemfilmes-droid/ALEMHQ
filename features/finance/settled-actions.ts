"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { hasCapability } from "@/lib/auth/permissions";
import { getCurrentProfile } from "@/lib/auth/session";
import { canEditSettled, settledDbErrorMessage, type FinanceEntryType } from "@/lib/finance/settled-edit";
import { createClient } from "@/lib/supabase/server";
import { settledPayablePatch, settledReceivablePatch } from "@/features/finance/rows";
import {
  reverseSettlementSchema,
  settledPayableSchema,
  settledReceivableSchema,
  type SettledPayableValues,
  type SettledReceivableValues,
} from "@/features/finance/schemas";
import type { FinanceHistoryEntry } from "@/features/finance/types";
import type { ActionResult } from "@/types";
import type { Json } from "@/types/database";

/**
 * Editar lançamento já baixado e estornar a baixa. Quem pode: diretoria e squad financeiro — conferido
 * aqui e de novo no banco (finance_edit_settled / finance_reverse_settlement), que também grava o
 * histórico, confere a versão (edição concorrente) e recusa cancelados.
 */

const FORBIDDEN: ActionResult = { ok: false, error: "Só a diretoria e o squad financeiro alteram lançamentos baixados." };
const INVALID: ActionResult = { ok: false, error: "Revise os campos e tente novamente." };
const idSchema = z.string().uuid();
const versionSchema = z.number().int().positive();
const entryTypeSchema = z.enum(["payable", "receivable"]);

async function requireSettledEditor() {
  const profile = await getCurrentProfile();
  return profile && canEditSettled(profile.squads) ? profile : null;
}

// Totais, relatórios e dashboards são calculados na hora a partir dos dados: basta revalidar as telas.
function refresh() {
  revalidatePath("/financeiro");
  revalidatePath("/inicio");
  revalidatePath("/metas", "layout");
  revalidatePath("/projetos", "layout");
  revalidatePath("/clientes", "layout");
}

async function runEdit(type: FinanceEntryType, id: string, expectedVersion: number, patch: Record<string, unknown>, reason: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("finance_edit_settled", {
    p_entry_type: type,
    p_entry_id: id,
    p_expected_version: expectedVersion,
    p_patch: patch as Json,
    p_reason: reason === "" ? undefined : reason,
  });
  if (error) {
    console.error("finance_edit_settled:", error.code, error.message);
    return { ok: false, error: settledDbErrorMessage(error) };
  }
  refresh();
  return { ok: true, message: "Alterações salvas." };
}

export async function editSettledPayableAction(id: string, expectedVersion: number, values: SettledPayableValues): Promise<ActionResult> {
  if (!(await requireSettledEditor())) return FORBIDDEN;
  const parsed = settledPayableSchema.safeParse(values);
  if (!idSchema.safeParse(id).success || !versionSchema.safeParse(expectedVersion).success || !parsed.success) return INVALID;
  return runEdit("payable", id, expectedVersion, settledPayablePatch(parsed.data), parsed.data.reason);
}

export async function editSettledReceivableAction(id: string, expectedVersion: number, values: SettledReceivableValues): Promise<ActionResult> {
  if (!(await requireSettledEditor())) return FORBIDDEN;
  const parsed = settledReceivableSchema.safeParse(values);
  if (!idSchema.safeParse(id).success || !versionSchema.safeParse(expectedVersion).success || !parsed.success) return INVALID;
  return runEdit("receivable", id, expectedVersion, settledReceivablePatch(parsed.data), parsed.data.reason);
}

/** Estornar baixa: volta a ficar em aberto; a baixa antiga fica no histórico. */
export async function reverseSettlementAction(type: FinanceEntryType, id: string, expectedVersion: number, values: { reason: string }): Promise<ActionResult> {
  if (!(await requireSettledEditor())) return FORBIDDEN;
  const parsed = reverseSettlementSchema.safeParse(values);
  if (!entryTypeSchema.safeParse(type).success || !idSchema.safeParse(id).success || !versionSchema.safeParse(expectedVersion).success) return INVALID;
  if (!parsed.success) return { ok: false, error: "Informe o motivo do estorno." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("finance_reverse_settlement", {
    p_entry_type: type,
    p_entry_id: id,
    p_expected_version: expectedVersion,
    p_reason: parsed.data.reason,
  });
  if (error) {
    console.error("finance_reverse_settlement:", error.code, error.message);
    return { ok: false, error: settledDbErrorMessage(error) };
  }
  refresh();
  return { ok: true, message: type === "payable" ? "Baixa estornada: o pagamento voltou a ficar em aberto." : "Baixa estornada: o recebimento voltou a ficar em aberto." };
}

/** "Histórico de alterações" do lançamento — quem vê o financeiro (a RLS repete a regra). */
export async function getEntryHistoryAction(type: FinanceEntryType, id: string): Promise<FinanceHistoryEntry[]> {
  const profile = await getCurrentProfile();
  if (!profile || !hasCapability(profile, "finance")) return [];
  if (!entryTypeSchema.safeParse(type).success || !idSchema.safeParse(id).success) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("financial_entry_history")
    .select("id, action, changed_at, reason, changes, author:profiles!financial_entry_history_changed_by_fkey(full_name)")
    .eq("entry_type", type)
    .eq("entry_id", id)
    .order("changed_at", { ascending: false });
  if (error) {
    console.error("getEntryHistoryAction:", error.code, error.message);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    action: row.action,
    changedAt: row.changed_at,
    changedByName: row.author?.full_name ?? "Sistema",
    reason: row.reason,
    changes: row.changes && typeof row.changes === "object" && !Array.isArray(row.changes) ? (row.changes as FinanceHistoryEntry["changes"]) : {},
  }));
}
