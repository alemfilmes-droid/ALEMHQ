"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/session";
import { disconnectGoogleAccount, syncGoogleForProfile } from "@/lib/google/calendar.server";
import type { ActionResult } from "@/types";

/** Desconecta a PRÓPRIA conta Google (apaga do Google o que o HQ tinha criado). */
export async function disconnectGoogleAction(): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Sessão expirada. Entre novamente." };
  await disconnectGoogleAccount(profile.id);
  revalidatePath("/configuracoes");
  revalidatePath("/agenda");
  return { ok: true, message: "Google Agenda desconectado." };
}

export async function syncGoogleNowAction(): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Sessão expirada. Entre novamente." };
  const stats = await syncGoogleForProfile(profile.id);
  revalidatePath("/configuracoes");
  revalidatePath("/agenda");
  return { ok: true, message: `Sincronizado: ${stats.created} novos, ${stats.updated} atualizados, ${stats.deleted} removidos.` };
}
