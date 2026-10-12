import "server-only";
import type { BusySource } from "@/lib/prospeccao/busy";
import { listGoogleBusy } from "@/lib/google/calendar.server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Agenda do Google da pessoa, lida ao vivo (escopo calendar.events). */
export function googleBusySource(profileId: string): BusySource {
  return { label: "Google Agenda", load: (from, to) => listGoogleBusy(profileId, from, to) };
}

/** Compromissos do HQ da pessoa (dona ou participante), inclusive os ainda não sincronizados. */
export function hqCommitmentsSource(profileId: string): BusySource {
  return {
    label: "Agenda do HQ",
    load: async (from, to) => {
      const { data, error } = await createAdminClient()
        .from("commitments")
        .select("starts_at, ends_at")
        .or(`owner_id.eq.${profileId},attendees.cs.{${profileId}}`)
        .neq("status", "cancelado")
        .lt("starts_at", to.toISOString())
        .gt("ends_at", from.toISOString());
      if (error) throw new Error(error.message);
      return (data ?? []).map((row) => ({ start: row.starts_at, end: row.ends_at }));
    },
  };
}

/** Quem atende as reuniões da prospecção: o master com a agenda do Google conectada (o Anderson). */
export async function meetingHost(): Promise<{ id: string; name: string } | null> {
  const { data } = await createAdminClient()
    .from("google_accounts")
    .select("profile:profiles!inner(id, full_name, org_level, is_active)")
    .eq("profile.org_level", "master")
    .eq("profile.is_active", true)
    .limit(1)
    .maybeSingle();
  return data?.profile ? { id: data.profile.id, name: data.profile.full_name } : null;
}
