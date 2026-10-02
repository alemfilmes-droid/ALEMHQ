"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";
import { getCommitmentForm } from "@/features/agenda/queries";
import { toRRule } from "@/features/agenda/recurrence";
import { commitmentSchema, type CommitmentValues } from "@/features/agenda/schemas";
import type { AgendaConflict, CommitmentFormRow } from "@/features/agenda/types";
import { getCurrentProfile } from "@/lib/auth/session";
import { appZoneToIso } from "@/lib/calendar";
import { syncGoogleForProfiles } from "@/lib/google/calendar.server";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, Tables } from "@/types";

const UNAUTHENTICATED = { ok: false, error: "Sessão expirada. Entre novamente." } as const;
const INVALID = { ok: false, error: "Revise os campos e tente novamente." } as const;

export type SaveCommitmentResult = ActionResult | { ok: false; error: string; conflicts: AgendaConflict[] };

function refresh() {
  revalidatePath("/agenda");
  revalidatePath("/inicio");
  revalidatePath("/minhas-pautas");
}

/** Depois de responder: atualiza o Google Agenda de quem foi afetado (só quem conectou a conta). */
function syncGoogleLater(profileIds: readonly string[]) {
  after(() => syncGoogleForProfiles(profileIds).catch((error) => console.error("[google] sync após mudança falhou", error)));
}

export async function getCommitmentFormAction(id: string): Promise<CommitmentFormRow | null> {
  if (!z.string().uuid().safeParse(id).success) return null;
  return getCommitmentForm(id);
}

function toRow(values: CommitmentValues) {
  const startsAt = appZoneToIso(values.date, values.allDay ? "00:00" : values.startTime);
  const endsAt = appZoneToIso(values.date, values.allDay ? "23:59" : values.endTime);
  return {
    title: values.title,
    kind: values.kind,
    starts_at: startsAt,
    ends_at: endsAt,
    all_day: values.allDay,
    attendees: values.attendees,
    external_attendees: values.externalAttendees.map((item) => ({ name: item.name, email: item.email })),
    location_or_link: values.location || null,
    notes: values.notes || null,
    company_id: values.companyId || null,
    project_id: values.projectId || null,
    deal_id: values.dealId || null,
    pauta_id: values.pautaId || null,
    reminder_minutes: values.reminder ? [Number(values.reminder)] : [],
    visibility: values.visibility,
    recurrence_rule: toRRule(values.recurrence, values.recurrenceUntil),
  } satisfies Tables["commitments"]["Update"];
}

/**
 * Cria ou edita um compromisso. Antes de gravar, confere conflitos de horário de cada pessoa
 * (dono e participantes) na primeira ocorrência — dia inteiro não bloqueia. Com conflito e sem
 * `confirmConflicts`, devolve a lista para a pessoa decidir; confirmando, grava mesmo assim.
 * Permissão de verdade: RLS de commitments (dono, criador ou diretoria editam).
 */
export async function saveCommitmentAction(
  values: CommitmentValues,
  options: { id?: string; confirmConflicts?: boolean } = {},
): Promise<SaveCommitmentResult> {
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  const parsed = commitmentSchema.safeParse(values);
  if (!parsed.success) return INVALID;
  if (options.id && !z.string().uuid().safeParse(options.id).success) return INVALID;

  const supabase = await createClient();
  const row = toRow(parsed.data);

  let ownerId = profile.id;
  let previousAttendees: string[] = [];
  if (options.id) {
    const { data: existing } = await supabase.from("commitments").select("owner_id, attendees").eq("id", options.id).maybeSingle();
    if (!existing) return { ok: false, error: "Compromisso não encontrado." };
    ownerId = existing.owner_id;
    previousAttendees = existing.attendees;
  }

  if (!row.all_day && !options.confirmConflicts) {
    const people = [...new Set([ownerId, ...row.attendees])];
    const { data: conflicts, error } = await supabase.rpc("agenda_conflicts", {
      p_starts_at: row.starts_at,
      p_ends_at: row.ends_at,
      p_people: people,
      p_exclude_id: options.id,
    });
    if (error) return { ok: false, error: "Não foi possível verificar conflitos de horário." };
    if (conflicts && conflicts.length > 0) {
      return {
        ok: false,
        error: "Há conflito de horário.",
        conflicts: conflicts.map((item) => ({
          profileId: item.profile_id,
          profileName: item.profile_name,
          title: item.title,
          startsAt: item.starts_at,
          endsAt: item.ends_at,
          source: item.source,
        })),
      };
    }
  }

  if (options.id) {
    const { data, error } = await supabase.from("commitments").update(row).eq("id", options.id).select("id").maybeSingle();
    if (error) return { ok: false, error: error.code === "23514" ? error.message : "Não foi possível salvar o compromisso." };
    if (!data) return { ok: false, error: "Só quem criou, o dono ou a diretoria editam este compromisso." };
    refresh();
    syncGoogleLater([ownerId, ...row.attendees, ...previousAttendees]);
    return { ok: true, message: "Compromisso atualizado." };
  }

  const { error } = await supabase.from("commitments").insert({ ...row, owner_id: profile.id, created_by: profile.id });
  if (error) return { ok: false, error: error.code === "23514" ? error.message : "Não foi possível criar o compromisso." };
  refresh();
  syncGoogleLater([profile.id, ...row.attendees]);
  return { ok: true, message: "Compromisso criado." };
}

/** Cancelar mantém o registro (status "cancelado") — some do calendário e dos conflitos. */
export async function cancelCommitmentAction(id: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) return INVALID;
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;

  const supabase = await createClient();
  const { data, error } = await supabase.from("commitments").update({ status: "cancelado" }).eq("id", id).select("id, owner_id, attendees").maybeSingle();
  if (error) return { ok: false, error: "Não foi possível cancelar o compromisso." };
  if (!data) return { ok: false, error: "Só quem criou, o dono ou a diretoria cancelam este compromisso." };
  refresh();
  syncGoogleLater([data.owner_id, ...data.attendees]);
  return { ok: true, message: "Compromisso cancelado." };
}
