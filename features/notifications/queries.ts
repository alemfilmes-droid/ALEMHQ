import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Notification } from "@/types";

export interface NotificationsSnapshot {
  items: Notification[];
  unreadCount: number;
}

const EMPTY: NotificationsSnapshot = { items: [], unreadCount: 0 };

/** As 10 mais recentes + contagem de não lidas. A RLS já restringe ao próprio usuário. */
export async function getNotificationsSnapshot(): Promise<NotificationsSnapshot> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return EMPTY;

  const [list, unread] = await Promise.all([
    supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(10),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);

  return { items: list.data ?? [], unreadCount: unread.count ?? 0 };
}
