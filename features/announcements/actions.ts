"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { announcementSchema, type AnnouncementValues } from "@/features/announcements/schemas";
import { hasCapability } from "@/lib/auth/permissions";
import { getCurrentProfile } from "@/lib/auth/session";
import { appZoneToIso } from "@/lib/calendar";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, Tables } from "@/types";

const UNAUTHENTICATED = { ok: false, error: "Sessão expirada. Entre novamente." } as const;
const FORBIDDEN = { ok: false, error: "Só a diretoria publica avisos." } as const;
const INVALID = { ok: false, error: "Revise os campos e tente novamente." } as const;

function refresh() {
  revalidatePath("/avisos");
  revalidatePath("/", "layout");
}

function toRow(values: AnnouncementValues) {
  return {
    title: values.title,
    body: values.body,
    published_at: appZoneToIso(values.publishDate, values.publishTime),
    expires_at: values.expiresDate ? appZoneToIso(values.expiresDate, values.expiresTime || "23:59") : null,
    audience_squads: values.audienceSquads,
    audience_levels: values.audienceLevels,
    is_pinned: values.isPinned,
  } satisfies Tables["announcements"]["Update"];
}

/** Cria ou edita um aviso. Permissão de verdade: RLS (can_manage_company()). */
export async function saveAnnouncementAction(values: AnnouncementValues, id?: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  if (!hasCapability(profile, "manageCompany")) return FORBIDDEN;
  const parsed = announcementSchema.safeParse(values);
  if (!parsed.success) return INVALID;
  if (id && !z.string().uuid().safeParse(id).success) return INVALID;

  const supabase = await createClient();
  const row = toRow(parsed.data);
  const { error } = id
    ? await supabase.from("announcements").update(row).eq("id", id)
    : await supabase.from("announcements").insert({ ...row, author_id: profile.id });
  if (error) return { ok: false, error: "Não foi possível salvar o aviso." };

  // Publicação imediata já notifica agora; agendada notifica quando o horário chegar.
  await supabase.rpc("publish_due_announcements");
  refresh();
  const scheduled = new Date(row.published_at) > new Date();
  return { ok: true, message: id ? "Aviso atualizado." : scheduled ? "Aviso programado." : "Aviso publicado." };
}

export async function setAnnouncementArchivedAction(id: string, archived: boolean): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  if (!hasCapability(profile, "manageCompany")) return FORBIDDEN;
  if (!z.string().uuid().safeParse(id).success) return INVALID;

  const supabase = await createClient();
  const { error } = await supabase
    .from("announcements")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { ok: false, error: "Não foi possível atualizar o aviso." };
  refresh();
  return { ok: true, message: archived ? "Aviso encerrado." : "Aviso reativado." };
}

/** Marca o aviso como lido (some do badge) e as notificações dele também. */
export async function markAnnouncementReadAction(id: string): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;
  if (!z.string().uuid().safeParse(id).success) return INVALID;

  const supabase = await createClient();
  await supabase.from("announcement_reads").upsert({ announcement_id: id, profile_id: profile.id }, { ignoreDuplicates: true });
  await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", profile.id)
    .eq("entity_type", "announcement")
    .eq("entity_id", id)
    .is("read_at", null);
  refresh();
  return { ok: true };
}
