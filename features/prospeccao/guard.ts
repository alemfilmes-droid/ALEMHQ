import "server-only";
import { revalidatePath } from "next/cache";
import { PROSPECTING_PATH } from "@/features/prospeccao/labels";
import { hasCapability } from "@/lib/auth/permissions";
import { getCurrentProfile } from "@/lib/auth/session";
import type { ProfileWithSquads } from "@/types";

export const FORBIDDEN = { ok: false, error: "Só o Anderson altera as configurações da prospecção." } as const;

/** Profile de quem pode editar Configurações > Prospecção (master). A RLS repete a regra com is_master(). */
export async function prospectingManager(): Promise<ProfileWithSquads | null> {
  const profile = await getCurrentProfile();
  return profile && hasCapability(profile, "manageProspecting") ? profile : null;
}

export function firstIssue(error: { issues: readonly { message: string }[] }): string {
  return error.issues[0]?.message ?? "Revise os campos.";
}

export function revalidateProspecting() {
  revalidatePath(PROSPECTING_PATH);
}
