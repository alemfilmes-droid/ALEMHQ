"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/auth/session";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { profileSchema, type ProfileValues } from "@/lib/validations/profile";
import type { ActionResult } from "@/types";

const UNAUTHENTICATED: ActionResult = { ok: false, error: "Sessão expirada. Entre novamente." };

export async function updateProfileAction(values: ProfileValues): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) return { ok: false, error: "Revise os campos e tente novamente." };

  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, phone: parsed.data.phone || null })
    .eq("id", profile.id);
  if (error) return { ok: false, error: "Não foi possível salvar o perfil." };

  revalidatePath("/", "layout");
  return { ok: true, message: "Perfil atualizado." };
}

/** Recebe a URL pública do arquivo já enviado ao bucket e a grava no profile (ou limpa com null). */
export async function updateAvatarAction(avatarUrl: string | null): Promise<ActionResult> {
  const profile = await getCurrentProfile();
  if (!profile) return UNAUTHENTICATED;

  if (avatarUrl) {
    const expectedPrefix = `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${profile.id}/`;
    if (!avatarUrl.startsWith(expectedPrefix)) return { ok: false, error: "Imagem inválida." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", profile.id);
  if (error) return { ok: false, error: "Não foi possível salvar a foto." };

  revalidatePath("/", "layout");
  return { ok: true, message: avatarUrl ? "Foto atualizada." : "Foto removida." };
}
