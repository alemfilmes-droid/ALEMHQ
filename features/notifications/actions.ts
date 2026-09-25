"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";
import type { NotificationsSnapshot } from "@/features/notifications/queries";
import { getNotificationsSnapshot } from "@/features/notifications/queries";

export async function refreshNotificationsAction(): Promise<NotificationsSnapshot> {
  return getNotificationsSnapshot();
}

export async function markNotificationReadAction(id: string): Promise<ActionResult> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Notificação inválida." };
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Sessão expirada." };

  const supabase = await createClient();
  await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).eq("recipient_id", profile.id);

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Sessão expirada." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("recipient_id", profile.id)
    .is("read_at", null);
  if (error) return { ok: false, error: "Não foi possível marcar como lidas." };

  revalidatePath("/", "layout");
  return { ok: true, message: "Notificações marcadas como lidas." };
}
