"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dateOnlyToFortalezaTimestamp } from "@/features/crm/schemas";
import type { DealNoteDetail, DealNotesThreadData } from "@/features/crm/types";
import { canManageAllDeals } from "@/lib/auth/permissions";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";

const INVALID: ActionResult = { ok: false, error: "Revise os campos e tente novamente." };
const UNAUTHENTICATED: ActionResult = { ok: false, error: "Sessão expirada. Entre novamente." };

const noteSchema = z
  .object({
    dealId: z.string().uuid(),
    body: z.string().trim().min(1, "Escreva a mensagem.").max(4000, "Use até 4000 caracteres."),
    isRequest: z.boolean(),
    assignedTo: z.string().uuid().or(z.literal("")),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")),
    replyTo: z.string().uuid().or(z.literal("")),
  })
  .refine((value) => !value.isRequest || value.assignedTo !== "", { message: "Escolha para quem é o pedido.", path: ["assignedTo"] });

export type DealNoteValues = z.input<typeof noteSchema>;

function refresh() {
  revalidatePath("/crm");
  revalidatePath("/pautas");
  revalidatePath("/minhas-pautas");
}

/** Mensagens das funções do banco já vêm em português; o resto vira texto genérico. */
function failure(error: { code?: string; message: string }, fallback: string): ActionResult {
  const known = ["23514", "42501", "22023"].includes(error.code ?? "");
  return { ok: false, error: known ? error.message : fallback };
}

/** Conversa do negócio + quem pode receber pedidos. A RLS (can_view_deal_notes) decide quem lê. */
export async function getDealNotesAction(dealId: string): Promise<DealNotesThreadData | null> {
  const profile = await getCurrentProfile();
  if (!profile || !z.string().uuid().safeParse(dealId).success) return null;

  const supabase = await createClient();
  const [notesResult, membersResult] = await Promise.all([
    supabase
      .from("deal_notes")
      .select(
        "id, deal_id, body, is_request, due_at, reply_to_id, resolved_at, created_at, author:profiles!deal_notes_author_id_fkey(id, full_name, avatar_url), assignee:profiles!deal_notes_assigned_to_fkey(id, full_name, avatar_url), resolver:profiles!deal_notes_resolved_by_fkey(id, full_name, avatar_url)",
      )
      .eq("deal_id", dealId)
      .order("created_at"),
    supabase
      .from("profile_squads")
      .select("profile:profiles!inner(id, full_name, avatar_url, is_active)")
      .eq("squad", "comercial")
      .eq("profile.is_active", true),
  ]);

  const notes: DealNoteDetail[] = (notesResult.data ?? []).map((row) => ({
    id: row.id,
    deal_id: row.deal_id,
    body: row.body,
    is_request: row.is_request,
    due_at: row.due_at,
    reply_to_id: row.reply_to_id,
    resolved_at: row.resolved_at,
    created_at: row.created_at,
    author: row.author,
    assignee: row.assignee,
    resolver: row.resolver,
  }));
  const members = (membersResult.data ?? [])
    .map((row) => ({ id: row.profile.id, full_name: row.profile.full_name, avatar_url: row.profile.avatar_url }))
    .filter((member) => member.full_name.trim() !== "")
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));

  const canManageAll = canManageAllDeals(profile);
  return { notes, members, canRequest: canManageAll, canManageAll, currentUserId: profile.id };
}

export async function createDealNoteAction(values: DealNoteValues): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  const parsed = noteSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os campos e tente novamente." };
  const d = parsed.data;
  if (d.isRequest && !canManageAllDeals(profile)) {
    return { ok: false, error: "Só diretoria, master e o head comercial fazem pedidos. Deixe uma nota." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("deal_note_create", {
    p_deal_id: d.dealId,
    p_body: d.body,
    p_is_request: d.isRequest,
    ...(d.isRequest && d.assignedTo ? { p_assigned_to: d.assignedTo } : {}),
    ...(d.isRequest && d.dueDate ? { p_due_at: dateOnlyToFortalezaTimestamp(d.dueDate, "18:00") } : {}),
    ...(d.replyTo ? { p_reply_to: d.replyTo } : {}),
  });
  if (error) return failure(error, "Não foi possível enviar a mensagem.");

  refresh();
  return { ok: true, message: d.isRequest ? "Pedido enviado." : d.replyTo ? "Resposta enviada." : "Nota registrada." };
}

export async function setDealNoteResolvedAction(noteId: string, resolved: boolean): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  if (!z.string().uuid().safeParse(noteId).success) return INVALID;

  const supabase = await createClient();
  const { error } = await supabase.rpc("deal_note_set_resolved", { p_note_id: noteId, p_resolved: resolved });
  if (error) return failure(error, "Não foi possível atualizar o pedido.");

  refresh();
  return { ok: true, message: resolved ? "Pedido resolvido." : "Pedido reaberto." };
}

export async function deleteDealNoteAction(noteId: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  if (!z.string().uuid().safeParse(noteId).success) return INVALID;

  const supabase = await createClient();
  const { data, error } = await supabase.from("deal_notes").delete().eq("id", noteId).select("id");
  if (error || !data?.length) return { ok: false, error: "Só quem escreveu pode apagar a mensagem." };

  refresh();
  return { ok: true, message: "Mensagem apagada." };
}
