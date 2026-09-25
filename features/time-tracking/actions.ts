"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { toIsoFromLocal } from "@/features/time-tracking/format";
import { canManageTimeTracking } from "@/lib/auth/permissions";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { editEntrySchema, manualEntrySchema, workScheduleSchema } from "@/lib/validations/time-entry";
import type { ActionResult, TimeEntryKind } from "@/types";

const INVALID: ActionResult = { ok: false, error: "Revise os campos e tente novamente." };
const UNAUTHENTICATED: ActionResult = { ok: false, error: "Sessão expirada. Entre novamente." };
const FORBIDDEN: ActionResult = { ok: false, error: "Você não tem permissão para esta ação." };

function refresh() {
  revalidatePath("/inicio");
  revalidatePath("/banco-de-horas");
}

/**
 * time_entries_before_write() sinaliza violação de regra de negócio (sessão já aberta, saída sem
 * entrada, horário no futuro) com os errcodes 23514/22023 — nesses casos a mensagem do banco já é
 * a frase certa para mostrar. Qualquer outro erro usa a mensagem genérica de fallback.
 */
function describeWriteError(error: { code?: string; message: string }, fallback: string): string {
  return error.code === "23514" || error.code === "22023" ? error.message : fallback;
}

/** Fecha, em qualquer conta, sessões abertas de dias passados. Fogo-e-esqueça, sem notificação. */
export async function closeStaleTimeSessionsAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("close_stale_time_sessions");
}

/** Alterna o ponto: insere uma 'entrada' ou 'saida' agora mesmo. O trigger no banco valida a sequência. */
export async function toggleTimeEntryAction(kind: TimeEntryKind, note?: string): Promise<ActionResult> {
  const parsedKind = z.enum(["entrada", "saida"]).safeParse(kind);
  if (!parsedKind.success) return INVALID;
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;

  const supabase = await createClient();
  const { error } = await supabase.from("time_entries").insert({
    profile_id: profile.id,
    kind: parsedKind.data,
    occurred_at: new Date().toISOString(),
    source: "timer",
    note: note?.trim() ? note.trim() : null,
  });
  if (error) return { ok: false, error: describeWriteError(error, "Não foi possível registrar o ponto.") };

  refresh();
  return { ok: true, message: parsedKind.data === "entrada" ? "Ponto registrado." : "Ponto encerrado." };
}

export async function createManualEntryAction(values: unknown): Promise<ActionResult> {
  const parsed = manualEntrySchema.safeParse(values);
  if (!parsed.success) return INVALID;
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;

  const supabase = await createClient();
  const { error } = await supabase.from("time_entries").insert({
    profile_id: profile.id,
    kind: parsed.data.kind,
    occurred_at: toIsoFromLocal(parsed.data.date, parsed.data.time),
    source: "manual",
    note: parsed.data.note || null,
  });
  if (error) return { ok: false, error: describeWriteError(error, "Não foi possível criar o lançamento.") };

  refresh();
  return { ok: true, message: "Lançamento criado." };
}

export async function updateTimeEntryAction(id: string, values: unknown): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) return INVALID;
  const parsed = editEntrySchema.safeParse(values);
  if (!parsed.success) return INVALID;
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("time_entries")
    .update({
      kind: parsed.data.kind,
      occurred_at: toIsoFromLocal(parsed.data.date, parsed.data.time),
      note: parsed.data.note || null,
    })
    .eq("id", id)
    .eq("profile_id", profile.id)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: describeWriteError(error, "Não foi possível salvar.") };
  if (!updated) return FORBIDDEN;

  refresh();
  return { ok: true, message: "Lançamento editado." };
}

/** Exclusão lógica: marca deleted_at, some da listagem e dos totais, mas fica registrado no histórico. */
export async function deleteTimeEntryAction(id: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) return INVALID;
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("time_entries")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("profile_id", profile.id)
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: "Não foi possível remover." };
  if (!updated) return FORBIDDEN;

  refresh();
  return { ok: true, message: "Lançamento removido." };
}

/** Só diretoria/admin definem a carga horária de outra pessoa (RLS repete a mesma regra). */
export async function updateWorkScheduleAction(profileId: string, values: unknown): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(profileId).success) return INVALID;
  const parsed = workScheduleSchema.safeParse(values);
  if (!parsed.success) return INVALID;
  const profile = await getCurrentProfile();
  if (!profile || !canManageTimeTracking(profile)) return FORBIDDEN;

  const supabase = await createClient();
  const { error } = await supabase
    .from("work_schedules")
    .update({ daily_hours: parsed.data.dailyHours, workdays: parsed.data.workdays, effective_from: parsed.data.effectiveFrom })
    .eq("profile_id", profileId);
  if (error) return { ok: false, error: "Não foi possível salvar a carga horária." };

  revalidatePath("/banco-de-horas");
  return { ok: true, message: "Carga horária atualizada." };
}
