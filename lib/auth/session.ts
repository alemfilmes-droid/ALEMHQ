import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { can, hasCapability, type Action, type Capability } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import type { ProfileWithSquads, Squad } from "@/types";

/** Profile do usuário autenticado e ativo, com os squads resolvidos (ou null). Deduplicado por request. */
export const getCurrentProfile = cache(async (): Promise<ProfileWithSquads | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*, profile_squads(squad, is_lead)")
    .eq("id", user.id)
    .maybeSingle();
  if (!data) return null;

  const { profile_squads, ...profile } = data;
  const squads: Squad[] = profile_squads.map((row) => row.squad);
  const leadSquads: Squad[] = profile_squads.filter((row) => row.is_lead).map((row) => row.squad);
  return { ...profile, squads, leadSquads };
});

export async function requireProfile(): Promise<ProfileWithSquads> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

/** Para server actions: retorna o profile se o papel puder executar a ação. */
export async function authorize(action: Action): Promise<ProfileWithSquads | null> {
  const profile = await getCurrentProfile();
  return profile && can(profile.access_role, action) ? profile : null;
}

/** Para server actions: retorna o profile se a capability (squad/flag) permitir a ação. */
export async function authorizeCapability(capability: Capability): Promise<ProfileWithSquads | null> {
  const profile = await getCurrentProfile();
  return profile && hasCapability(profile, capability) ? profile : null;
}
