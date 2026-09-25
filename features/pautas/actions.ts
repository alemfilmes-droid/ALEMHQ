"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canFullyManagePauta } from "@/lib/auth/permissions";
import { getCurrentProfile } from "@/lib/auth/session";
import { nullIfEmpty } from "@/lib/validations/company";
import {
  commentSchema,
  createPautaSchema,
  handoverSchema,
  moveColumnSchema,
  updatePautaSchema,
  type CreatePautaValues,
  type HandoverValues,
  type UpdatePautaValues,
} from "@/lib/validations/pauta";
import { createClient } from "@/lib/supabase/server";
import { getPautaDetail } from "@/features/pautas/queries";
import type { PautaDetail } from "@/features/pautas/types";
import type { ActionResult, ProductionFunction, Tables } from "@/types";
import type { Database } from "@/types/database";

const FORBIDDEN: ActionResult = { ok: false, error: "Você não tem permissão para esta ação." };
const INVALID: ActionResult = { ok: false, error: "Revise os campos e tente novamente." };
const UNAUTHENTICATED: ActionResult = { ok: false, error: "Sessão expirada. Entre novamente." };

function refresh(projectId?: string | null) {
  revalidatePath("/pautas");
  revalidatePath("/minhas-pautas");
  revalidatePath("/inicio");
  if (projectId) revalidatePath(`/projetos/${projectId}`);
}

/** O modal de detalhe abre a partir de um id (clique no card); busca tudo sob demanda. */
export async function getPautaDetailAction(id: string): Promise<PautaDetail | null> {
  if (!z.string().uuid().safeParse(id).success) return null;
  return getPautaDetail(id);
}

export async function createPautaAction(values: CreatePautaValues): Promise<ActionResult & { id?: string }> {
  const actor = await getCurrentProfile();
  if (!actor || !canFullyManagePauta(actor)) return FORBIDDEN;
  const parsed = createPautaSchema.safeParse(values);
  if (!parsed.success) return INVALID;
  const data = parsed.data;

  const scheduledAt =
    data.scheduledDate && data.scheduledTime ? new Date(`${data.scheduledDate}T${data.scheduledTime}:00`).toISOString() : null;

  const supabase = await createClient();
  const { data: pauta, error } = await supabase
    .from("pautas")
    // board_column e status são NOT NULL sem default no SQL — o trigger before-insert calcula
    // um a partir do outro quando só um dos dois vem preenchido. O cast cobre esse caso (o tipo
    // gerado não sabe do trigger e exige os dois).
    .insert({
      project_id: data.projectId,
      title: data.title,
      briefing: nullIfEmpty(data.briefing),
      lead_id: data.leadId,
      // O líder começa como responsável atual; passa adiante quem pega a próxima etapa.
      current_assignee_id: data.leadId,
      board_column: data.boardColumn || undefined,
      priority: data.priority,
      is_critical: data.isCritical,
      capture_type: data.captureType,
      format: nullIfEmpty(data.format),
      location_address: nullIfEmpty(data.locationAddress),
      scheduled_at: scheduledAt,
      duration_minutes: data.durationMinutes === "" ? null : Number(data.durationMinutes),
      start_date: nullIfEmpty(data.startDate),
      due_date: nullIfEmpty(data.dueDate),
      contact_id: data.contactId || null,
      contact_phone_override: nullIfEmpty(data.contactPhoneOverride),
      drive_folder_url: nullIfEmpty(data.driveFolderUrl),
      script_url: nullIfEmpty(data.scriptUrl),
      equipment_notes: nullIfEmpty(data.equipmentNotes),
    } as Tables["pautas"]["Insert"])
    .select("id")
    .single();

  if (error) {
    const mismatch = error.code === "23514";
    return { ok: false, error: mismatch ? "O contato não pertence ao cliente deste projeto." : "Não foi possível criar a pauta." };
  }

  refresh(data.projectId);
  return { ok: true, message: "Pauta criada.", id: pauta.id };
}

/** Edição pontual do briefing da pauta. A RLS (can_edit_pauta) decide quem pode salvar. */
export async function updatePautaAction(id: string, values: UpdatePautaValues): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) return INVALID;
  const parsed = updatePautaSchema.safeParse(values);
  if (!parsed.success) return INVALID;
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;

  const d = parsed.data;
  const patch: Database["public"]["Tables"]["pautas"]["Update"] = {};
  if (d.title !== undefined) patch.title = d.title;
  if (d.briefing !== undefined) patch.briefing = d.briefing === null ? null : nullIfEmpty(d.briefing);
  if (d.status !== undefined) patch.status = d.status;
  if (d.priority !== undefined) patch.priority = d.priority;
  if (d.isCritical !== undefined) patch.is_critical = d.isCritical;
  if (d.leadId !== undefined) patch.lead_id = d.leadId;
  if (d.captureType !== undefined) patch.capture_type = d.captureType;
  if (d.format !== undefined) patch.format = d.format === null ? null : nullIfEmpty(d.format);
  if (d.locationAddress !== undefined) patch.location_address = d.locationAddress === null ? null : nullIfEmpty(d.locationAddress);
  if (d.scheduledAt !== undefined) patch.scheduled_at = d.scheduledAt;
  if (d.durationMinutes !== undefined) patch.duration_minutes = d.durationMinutes;
  if (d.startDate !== undefined) patch.start_date = d.startDate;
  if (d.dueDate !== undefined) patch.due_date = d.dueDate;
  if (d.contactId !== undefined) patch.contact_id = d.contactId;
  if (d.contactPhoneOverride !== undefined) patch.contact_phone_override = d.contactPhoneOverride;
  if (d.driveFolderUrl !== undefined) patch.drive_folder_url = d.driveFolderUrl;
  if (d.deliveryUrl !== undefined) patch.delivery_url = d.deliveryUrl;
  if (d.scriptUrl !== undefined) patch.script_url = d.scriptUrl;
  if (d.equipmentNotes !== undefined) patch.equipment_notes = d.equipmentNotes;

  if (Object.keys(patch).length === 0) return { ok: true };

  const supabase = await createClient();
  const { data: updated, error } = await supabase.from("pautas").update(patch).eq("id", id).select("project_id").maybeSingle();
  if (error) return { ok: false, error: error.code === "42501" ? error.message : "Não foi possível salvar." };
  if (!updated) return { ok: false, error: "Você não pode editar esta pauta." };

  refresh(updated.project_id);
  return { ok: true, message: "Salvo." };
}

/** Arrastar entre colunas: usa a RPC pauta_move_column, que já checa permissão e devolve a linha. */
export async function movePautaColumnAction(input: { id: string; column: string }): Promise<ActionResult> {
  const parsed = moveColumnSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pauta_move_column", { p_pauta_id: parsed.data.id, p_column: parsed.data.column });
  if (error) return { ok: false, error: error.message.includes("permissão") ? error.message : "Não foi possível mover a pauta." };

  refresh(data?.project_id);
  return { ok: true };
}

/** "Passar adiante": muda status, responsável atual, prazo da etapa e adiciona o responsável à equipe — atômico. */
export async function handoverPautaAction(values: HandoverValues): Promise<ActionResult> {
  const parsed = handoverSchema.safeParse(values);
  if (!parsed.success) return INVALID;
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  const d = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pauta_handover", {
    p_pauta_id: d.pautaId,
    p_status: d.status,
    p_assignee_id: d.assigneeId,
    p_function: d.functionRole,
    p_due_date: d.dueDate || undefined,
    p_note: d.note || undefined,
  });
  if (error) return { ok: false, error: error.message.includes("permissão") ? error.message : "Não foi possível passar a pauta adiante." };

  refresh(data?.project_id);
  return { ok: true, message: "Pauta passada adiante." };
}

export async function addPautaCommentAction(input: { pautaId: string; body: string }): Promise<ActionResult> {
  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) return INVALID;
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;

  const supabase = await createClient();
  const { error } = await supabase.from("pauta_comments").insert({
    pauta_id: parsed.data.pautaId,
    author_id: profile.id,
    body: parsed.data.body,
  });
  if (error) return { ok: false, error: "Não foi possível comentar." };

  revalidatePath("/pautas");
  revalidatePath("/minhas-pautas");
  return { ok: true };
}

export async function addPautaMemberAction(input: {
  pautaId: string;
  profileId: string;
  productionFunction: string;
}): Promise<ActionResult> {
  const schema = z.object({ pautaId: z.string().uuid(), profileId: z.string().uuid(), productionFunction: z.string().min(1) });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return INVALID;
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  if (!canFullyManagePauta(profile)) return FORBIDDEN;

  const supabase = await createClient();
  const { error } = await supabase.from("pauta_members").insert({
    pauta_id: parsed.data.pautaId,
    profile_id: parsed.data.profileId,
    production_function: parsed.data.productionFunction as ProductionFunction,
  });
  if (error) {
    const duplicate = error.code === "23505";
    return { ok: false, error: duplicate ? "Essa pessoa já está nessa função." : "Não foi possível adicionar o responsável." };
  }

  revalidatePath("/pautas");
  revalidatePath("/minhas-pautas");
  return { ok: true, message: "Responsável adicionado." };
}

export async function removePautaMemberAction(input: {
  pautaId: string;
  profileId: string;
  productionFunction: string;
}): Promise<ActionResult> {
  const schema = z.object({ pautaId: z.string().uuid(), profileId: z.string().uuid(), productionFunction: z.string().min(1) });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return INVALID;
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  if (!canFullyManagePauta(profile)) return FORBIDDEN;

  const supabase = await createClient();
  const { error } = await supabase
    .from("pauta_members")
    .delete()
    .eq("pauta_id", parsed.data.pautaId)
    .eq("profile_id", parsed.data.profileId)
    .eq("production_function", parsed.data.productionFunction as ProductionFunction);
  if (error) return { ok: false, error: "Não foi possível remover o responsável." };

  revalidatePath("/pautas");
  revalidatePath("/minhas-pautas");
  return { ok: true, message: "Responsável removido." };
}
