import "server-only";
import { cache } from "react";
import type { AnnouncementItem, AnnouncementTab } from "@/features/announcements/types";
import { createClient } from "@/lib/supabase/server";

/** Gera as notificações dos avisos cujo horário chegou. Idempotente no banco; nunca derruba a página. */
export async function publishDueAnnouncements(): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc("publish_due_announcements");
  } catch {
    // Sem a migração aplicada ou erro transitório: a próxima navegação tenta de novo.
  }
}

/** Avisos ativos para a pessoa que ela ainda não abriu (badge da sidebar). */
export const getUnreadAnnouncementsCount = cache(async (): Promise<number> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("announcements_unread_count");
  return error ? 0 : (data ?? 0);
});

/**
 * Lista de uma aba. A RLS já devolve para quem não administra só o que está no ar e é para o
 * squad/nível da pessoa — o filtro por aba aqui só separa, para a diretoria, o que está programado
 * ou encerrado.
 */
export async function listAnnouncements(tab: AnnouncementTab, profileId: string): Promise<AnnouncementItem[]> {
  const supabase = await createClient();
  const now = new Date().toISOString();
  let query = supabase
    .from("announcements")
    .select("*, author:profiles!announcements_author_id_fkey(full_name, avatar_url), reads:announcement_reads(profile_id)")
    .eq("reads.profile_id", profileId);

  if (tab === "ativos") {
    query = query
      .is("archived_at", null)
      .lte("published_at", now)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order("is_pinned", { ascending: false })
      .order("published_at", { ascending: false });
  } else if (tab === "programados") {
    query = query.is("archived_at", null).gt("published_at", now).order("published_at", { ascending: true });
  } else {
    query = query.or(`archived_at.not.is.null,expires_at.lte.${now}`).order("published_at", { ascending: false }).limit(100);
  }

  const { data, error } = await query;
  if (error) throw new Error("Falha ao carregar os avisos.");
  return (data ?? []).map(({ author, reads, ...row }) => ({
    ...row,
    author_name: author?.full_name ?? null,
    author_avatar_url: author?.avatar_url ?? null,
    is_read: (reads ?? []).length > 0,
  }));
}
