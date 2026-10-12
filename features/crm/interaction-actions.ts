"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { INTERACTION_CHANNELS } from "@/features/crm/labels";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { appZoneToIso } from "@/lib/calendar";
import type { ActionResult } from "@/types";

/**
 * Histórico de abordagens (relatório do Paulo, item 03): editar e riscar. O banco decide quem pode
 * (autor ou diretoria/admin), grava o histórico e tira o riscado da cadência e da meta de toques.
 */

const UNAUTHENTICATED: ActionResult = { ok: false, error: "Sessão expirada. Entre novamente." };

const editSchema = z.object({
  id: z.string().uuid(),
  channel: z.enum(INTERACTION_CHANNELS, { message: "Selecione o canal." }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Informe o horário."),
  summary: z.string().trim().min(5, "Escreva um resumo do que aconteceu.").max(280, "Use até 280 caracteres."),
  reason: z.string().trim().max(500, "Use até 500 caracteres."),
});

const strikeSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().min(3, "Informe o motivo para riscar o registro.").max(500, "Use até 500 caracteres."),
});

export type EditApproachValues = z.infer<typeof editSchema>;

function refresh() {
  revalidatePath("/crm");
  revalidatePath("/pautas");
  revalidatePath("/minhas-pautas");
  revalidatePath("/inicio");
}

function failure(error: { code?: string; message: string }, fallback: string): ActionResult {
  return { ok: false, error: ["22023", "42501", "23514"].includes(error.code ?? "") ? error.message : fallback };
}

export async function editApproachAction(values: EditApproachValues): Promise<ActionResult> {
  if (!(await getCurrentProfile())) return UNAUTHENTICATED;
  const parsed = editSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os campos." };
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("deal_interaction_update", {
    p_interaction_id: d.id,
    p_channel: d.channel,
    p_occurred_at: appZoneToIso(d.date, d.time),
    p_summary: d.summary,
    ...(d.reason ? { p_reason: d.reason } : {}),
  });
  if (error) return failure(error, "Não foi possível salvar a abordagem.");
  refresh();
  return { ok: true, message: "Abordagem atualizada." };
}

export async function strikeApproachAction(values: { id: string; reason: string }): Promise<ActionResult> {
  if (!(await getCurrentProfile())) return UNAUTHENTICATED;
  const parsed = strikeSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Informe o motivo." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("deal_interaction_delete", { p_interaction_id: parsed.data.id, p_reason: parsed.data.reason });
  if (error) return failure(error, "Não foi possível riscar o registro.");
  refresh();
  return { ok: true, message: "Registro riscado. Ele saiu da cadência e da meta de toques." };
}

export interface ApproachHistoryEntry {
  id: string;
  action: "EDIT" | "DELETE";
  changedAt: string;
  changedByName: string;
  reason: string | null;
  changes: Record<string, { before: unknown; after: unknown }>;
}

/** Histórico de uma abordagem. O risco (motivo, quem, quando) só volta para a diretoria/admin (RLS). */
export async function approachHistoryAction(interactionId: string): Promise<ApproachHistoryEntry[]> {
  if (!(await getCurrentProfile()) || !z.string().uuid().safeParse(interactionId).success) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("deal_interaction_history")
    .select("id, action, changed_at, reason, changes, author:profiles!deal_interaction_history_changed_by_fkey(full_name)")
    .eq("interaction_id", interactionId)
    .order("changed_at", { ascending: false });
  return (data ?? []).map((row) => ({
    id: row.id,
    action: row.action === "DELETE" ? "DELETE" : "EDIT",
    changedAt: row.changed_at,
    changedByName: row.author?.full_name ?? "Sistema",
    reason: row.reason,
    changes: row.changes && typeof row.changes === "object" && !Array.isArray(row.changes) ? (row.changes as ApproachHistoryEntry["changes"]) : {},
  }));
}
