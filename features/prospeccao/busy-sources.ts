import "server-only";
import type { BusySource } from "@/lib/prospeccao/busy";
import { listGoogleBusy } from "@/lib/google/calendar.server";
import { busySourcesFor, type MeetingHostChoice } from "@/lib/prospeccao/meeting-host";
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

export interface ResolvedHost {
  id: string;
  name: string;
  googleConnected: boolean;
}

/** Uma pessoa como anfitriã da reunião, com a informação de o Google dela estar conectado. */
export async function profileHost(profileId: string): Promise<ResolvedHost | null> {
  const admin = createAdminClient();
  const [{ data: profile }, { data: account }] = await Promise.all([
    admin.from("profiles").select("id, full_name").eq("id", profileId).maybeSingle(),
    admin.from("google_accounts").select("profile_id").eq("profile_id", profileId).maybeSingle(),
  ]);
  return profile ? { id: profile.id, name: profile.full_name, googleConnected: Boolean(account) } : null;
}

/** SDR dono do lead (kick-off). */
async function dealOwnerHost(dealId: string): Promise<ResolvedHost | null> {
  const { data: deal } = await createAdminClient().from("deals").select("owner_id").eq("id", dealId).maybeSingle();
  return deal?.owner_id ? profileHost(deal.owner_id) : null;
}

/** Quem atende a reunião para a escolha feita (Anderson exige o Google dele conectado, como antes). */
export async function resolveMeetingHost(choice: MeetingHostChoice, dealId: string): Promise<{ ok: true; host: ResolvedHost } | { ok: false; error: string }> {
  if (choice === "sdr") {
    const owner = await dealOwnerHost(dealId);
    return owner ? { ok: true, host: owner } : { ok: false, error: "Não achei o SDR dono deste lead." };
  }
  const ceo = await meetingHost();
  return ceo ? { ok: true, host: { ...ceo, googleConnected: true } } : { ok: false, error: "A agenda do Anderson não está conectada ao HQ (Configurações › Google Agenda)." };
}

/** Fontes de horário ocupado de quem atende: Google (se conectado) e a agenda do HQ. */
export function busySourcesOf(host: ResolvedHost): BusySource[] {
  return busySourcesFor(host.googleConnected).map((source) => (source === "google" ? googleBusySource(host.id) : hqCommitmentsSource(host.id)));
}
