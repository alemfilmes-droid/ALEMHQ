import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";

/**
 * Google Agenda por pessoa (OAuth 2.0 + Calendar API v3 via fetch).
 *
 * Mão única HQ → Google: compromissos (dono ou participante), captações agendadas e prazos das
 * pautas em que a pessoa está viram eventos na agenda principal dela. O que muda no HQ é
 * atualizado; o que sai do HQ é apagado. Os eventos do próprio Google (fora os do HQ) são lidos e
 * aparecem na agenda do HQ só para a dona da conta.
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.events"];
const ZONE = "America/Fortaleza";
const HQ_KEY = "alemhq_key";

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleRedirectUri(): string {
  return `${publicEnv.NEXT_PUBLIC_SITE_URL}/api/google/callback`;
}

export function googleAuthUrl(state: string, loginHint?: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  if (loginHint) params.set("login_hint", loginHint);
  return `${AUTH_URL}?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      ...body,
    }),
  });
  const data = (await response.json().catch(() => ({}))) as Partial<TokenResponse> & { error?: string };
  if (!response.ok || !data.access_token) {
    throw new GoogleAuthError(data.error ?? `token ${response.status}`);
  }
  return data as TokenResponse;
}

export class GoogleAuthError extends Error {}

/** Troca o código do OAuth pelos tokens e grava a conta da pessoa. */
export async function connectGoogleAccount(profileId: string, code: string): Promise<void> {
  const tokens = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: googleRedirectUri() });
  if (!tokens.refresh_token) throw new GoogleAuthError("O Google não devolveu acesso contínuo. Tente conectar de novo.");

  const info: { email?: string } = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${tokens.access_token}` } })
    .then((response) => (response.ok ? (response.json() as Promise<{ email?: string }>) : {}))
    .catch(() => ({}));

  const admin = createAdminClient();
  const { error } = await admin.from("google_accounts").upsert({
    profile_id: profileId,
    google_email: info.email ?? null,
    refresh_token: tokens.refresh_token,
    access_token: tokens.access_token,
    access_token_expires_at: new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString(),
    scope: tokens.scope ?? null,
    connected_at: new Date().toISOString(),
    last_error: null,
  });
  if (error) throw new Error(`Falha ao gravar a conta Google: ${error.message}`);
  // Conta nova (ou outra conta): o que foi espelhado antes não vale mais.
  await admin.from("google_event_links").delete().eq("profile_id", profileId);
  await admin.from("google_calendar_events").delete().eq("profile_id", profileId);
}

type Account = {
  profile_id: string;
  refresh_token: string;
  access_token: string | null;
  access_token_expires_at: string | null;
};

async function accessTokenFor(account: Account): Promise<string> {
  if (account.access_token && account.access_token_expires_at && new Date(account.access_token_expires_at).getTime() > Date.now() + 30_000) {
    return account.access_token;
  }
  const tokens = await tokenRequest({ refresh_token: account.refresh_token, grant_type: "refresh_token" });
  await createAdminClient()
    .from("google_accounts")
    .update({ access_token: tokens.access_token, access_token_expires_at: new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString() })
    .eq("profile_id", account.profile_id);
  return tokens.access_token;
}

/** Desconecta: apaga do Google os eventos que o HQ criou, revoga o acesso e esquece a conta. */
export async function disconnectGoogleAccount(profileId: string): Promise<void> {
  const admin = createAdminClient();
  const { data: account } = await admin.from("google_accounts").select("profile_id, refresh_token, access_token, access_token_expires_at").eq("profile_id", profileId).maybeSingle();
  if (account) {
    try {
      const token = await accessTokenFor(account);
      const { data: links } = await admin.from("google_event_links").select("google_event_id").eq("profile_id", profileId);
      for (const link of links ?? []) {
        await fetch(`${API}/${encodeURIComponent(link.google_event_id)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }).catch(() => undefined);
      }
    } catch {
      // Sem acesso (já revogado): só esquece a conta.
    }
    await fetch(REVOKE_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: account.refresh_token }) }).catch(() => undefined);
  }
  await admin.from("google_event_links").delete().eq("profile_id", profileId);
  await admin.from("google_calendar_events").delete().eq("profile_id", profileId);
  await admin.from("google_accounts").delete().eq("profile_id", profileId);
}

// ---------------------------------------------------------------------------
// O que deve estar no Google de cada pessoa
// ---------------------------------------------------------------------------

type GoogleTime = { dateTime: string; timeZone: string } | { date: string };

interface DesiredEvent {
  key: string;
  summary: string;
  description: string;
  location?: string;
  start: GoogleTime;
  end: GoogleTime;
  recurrence?: string[];
  reminders?: { useDefault: false; overrides: { method: "popup"; minutes: number }[] };
}

function dateInZone(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONE }).format(new Date(iso));
}

function addDaysIso(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** yyyy-mm-dd + hh:mm em Fortaleza (UTC−3, sem horário de verão) → ISO. */
function fortalezaToIso(day: string, time: string): string {
  return new Date(`${day}T${time.slice(0, 5)}:00-03:00`).toISOString();
}

function link(path: string): string {
  return `${publicEnv.NEXT_PUBLIC_SITE_URL}${path}`;
}

async function desiredEventsFor(profileId: string, windowStart: Date, windowEnd: Date): Promise<DesiredEvent[]> {
  const admin = createAdminClient();
  const fromIso = windowStart.toISOString();
  const toIso = windowEnd.toISOString();
  const fromDay = dateInZone(fromIso);
  const toDay = dateInZone(toIso);

  const [owned, attending, membership] = await Promise.all([
    admin.from("commitments").select("*").eq("owner_id", profileId).neq("status", "cancelado").lte("starts_at", toIso),
    admin.from("commitments").select("*").contains("attendees", [profileId]).neq("status", "cancelado").lte("starts_at", toIso),
    admin.from("pauta_members").select("pauta_id").eq("profile_id", profileId),
  ]);

  const commitments = new Map([...(owned.data ?? []), ...(attending.data ?? [])].map((row) => [row.id, row]));
  const events: DesiredEvent[] = [];

  for (const row of commitments.values()) {
    if (!row.recurrence_rule && new Date(row.ends_at) < windowStart) continue;
    const base = {
      key: `c:${row.id}`,
      summary: row.title,
      description: [row.notes, `Além HQ: ${link(`/agenda?visao=dia&data=${dateInZone(row.starts_at)}&compromisso=${row.id}`)}`].filter(Boolean).join("\n\n"),
      location: row.location_or_link ?? undefined,
      recurrence: row.recurrence_rule ? [`RRULE:${row.recurrence_rule}`] : undefined,
      reminders: { useDefault: false as const, overrides: row.reminder_minutes.slice(0, 5).map((minutes) => ({ method: "popup" as const, minutes })) },
    };
    if (row.all_day) {
      const startDay = dateInZone(row.starts_at);
      events.push({ ...base, start: { date: startDay }, end: { date: addDaysIso(dateInZone(row.ends_at), 1) } });
    } else {
      events.push({ ...base, start: { dateTime: row.starts_at, timeZone: ZONE }, end: { dateTime: row.ends_at, timeZone: ZONE } });
    }
  }

  // Pautas em que a pessoa está: líder, responsável atual, quem é dona (avulsa) ou responsável adicional.
  const memberIds = (membership.data ?? []).map((row) => row.pauta_id);
  const people = `lead_id.eq.${profileId},current_assignee_id.eq.${profileId},created_for.eq.${profileId}${memberIds.length ? `,id.in.(${memberIds.join(",")})` : ""}`;
  const { data: pautas } = await admin
    .from("pautas_with_details")
    .select("id, title, status, board_column, scheduled_at, duration_minutes, due_date, due_time, location_address, company_name")
    .or(people)
    .is("archived_at", null);
  const linkedPautas = new Set([...commitments.values()].map((row) => row.pauta_id).filter(Boolean));

  for (const pauta of pautas ?? []) {
    if (!pauta.id || !pauta.title) continue;
    const url = link(`/minhas-pautas?pauta=${pauta.id}`);
    const client = pauta.company_name ? ` · ${pauta.company_name}` : "";
    if (pauta.scheduled_at && !linkedPautas.has(pauta.id) && pauta.scheduled_at >= fromIso && pauta.scheduled_at <= toIso) {
      const end = new Date(new Date(pauta.scheduled_at).getTime() + (pauta.duration_minutes ?? 60) * 60_000).toISOString();
      events.push({
        key: `p:${pauta.id}`,
        summary: `Captação: ${pauta.title}`,
        description: `Pauta${client}\n\nAlém HQ: ${url}`,
        location: pauta.location_address ?? undefined,
        start: { dateTime: pauta.scheduled_at, timeZone: ZONE },
        end: { dateTime: end, timeZone: ZONE },
      });
    }
    const done = pauta.board_column === "entregue" || pauta.status === "aprovado";
    if (pauta.due_date && !done && pauta.due_date >= fromDay && pauta.due_date <= toDay) {
      const dueEvent: DesiredEvent = pauta.due_time
        ? {
            key: `d:${pauta.id}`,
            summary: `Prazo: ${pauta.title}`,
            description: `Entrega${client}\n\nAlém HQ: ${url}`,
            start: { dateTime: new Date(new Date(fortalezaToIso(pauta.due_date, pauta.due_time)).getTime() - 30 * 60_000).toISOString(), timeZone: ZONE },
            end: { dateTime: fortalezaToIso(pauta.due_date, pauta.due_time), timeZone: ZONE },
          }
        : {
            key: `d:${pauta.id}`,
            summary: `Prazo: ${pauta.title}`,
            description: `Entrega${client}\n\nAlém HQ: ${url}`,
            start: { date: pauta.due_date },
            end: { date: addDaysIso(pauta.due_date, 1) },
          };
      events.push(dueEvent);
    }
  }

  return events;
}

function hashOf(event: DesiredEvent): string {
  return createHash("sha256").update(JSON.stringify(event)).digest("hex").slice(0, 32);
}

function toGoogleBody(event: DesiredEvent) {
  return {
    summary: event.summary,
    description: event.description,
    location: event.location,
    start: event.start,
    end: event.end,
    recurrence: event.recurrence,
    reminders: event.reminders ?? { useDefault: true },
    source: { title: "Além HQ", url: publicEnv.NEXT_PUBLIC_SITE_URL },
    extendedProperties: { private: { [HQ_KEY]: event.key } },
  };
}

async function googleFetch(token: string, url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
}

/** Espelha a agenda do HQ no Google da pessoa e lê os eventos do Google dela. */
export async function syncGoogleForProfile(profileId: string): Promise<{ created: number; updated: number; deleted: number }> {
  const admin = createAdminClient();
  const { data: account } = await admin.from("google_accounts").select("profile_id, refresh_token, access_token, access_token_expires_at").eq("profile_id", profileId).maybeSingle();
  if (!account) return { created: 0, updated: 0, deleted: 0 };

  const stats = { created: 0, updated: 0, deleted: 0 };
  try {
    const token = await accessTokenFor(account);
    const windowStart = new Date(Date.now() - 7 * 86_400_000);
    const windowEnd = new Date(Date.now() + 90 * 86_400_000);

    const [desired, linksResult] = await Promise.all([
      desiredEventsFor(profileId, windowStart, windowEnd),
      admin.from("google_event_links").select("source_key, google_event_id, content_hash").eq("profile_id", profileId),
    ]);
    const links = new Map((linksResult.data ?? []).map((row) => [row.source_key, row]));
    const desiredKeys = new Set(desired.map((event) => event.key));

    for (const event of desired) {
      const hash = hashOf(event);
      const existing = links.get(event.key);
      if (existing && existing.content_hash === hash) continue;

      if (existing) {
        const response = await googleFetch(token, `${API}/${encodeURIComponent(existing.google_event_id)}`, { method: "PUT", body: JSON.stringify(toGoogleBody(event)) });
        if (response.ok) {
          await admin.from("google_event_links").update({ content_hash: hash, updated_at: new Date().toISOString() }).eq("profile_id", profileId).eq("source_key", event.key);
          stats.updated += 1;
          continue;
        }
        if (response.status !== 404 && response.status !== 410) continue;
        // Apagado no Google: cria de novo abaixo.
      }

      const response = await googleFetch(token, API, { method: "POST", body: JSON.stringify(toGoogleBody(event)) });
      if (!response.ok) continue;
      const created = (await response.json()) as { id: string };
      await admin
        .from("google_event_links")
        .upsert({ profile_id: profileId, source_key: event.key, google_event_id: created.id, content_hash: hash, updated_at: new Date().toISOString() });
      stats.created += 1;
    }

    for (const [key, existing] of links) {
      if (desiredKeys.has(key)) continue;
      const response = await googleFetch(token, `${API}/${encodeURIComponent(existing.google_event_id)}`, { method: "DELETE" });
      if (response.ok || response.status === 404 || response.status === 410) {
        await admin.from("google_event_links").delete().eq("profile_id", profileId).eq("source_key", key);
        stats.deleted += 1;
      }
    }

    await importGoogleEvents(token, profileId, windowStart, windowEnd);
    await admin.from("google_accounts").update({ last_sync_at: new Date().toISOString(), last_error: null }).eq("profile_id", profileId);
  } catch (error) {
    const message =
      error instanceof GoogleAuthError ? "O acesso ao Google expirou ou foi removido. Conecte de novo." : error instanceof Error ? error.message.slice(0, 300) : "Falha na sincronização.";
    await admin.from("google_accounts").update({ last_error: message }).eq("profile_id", profileId);
  }
  return stats;
}

interface GoogleListedEvent {
  id: string;
  status?: string;
  summary?: string;
  location?: string;
  htmlLink?: string;
  transparency?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  extendedProperties?: { private?: Record<string, string> };
}

/** Eventos do próprio Google (não criados pelo HQ) para a agenda do HQ, só da dona da conta. */
async function importGoogleEvents(token: string, profileId: string, windowStart: Date, windowEnd: Date) {
  const admin = createAdminClient();
  const rows: {
    profile_id: string;
    google_event_id: string;
    title: string;
    starts_at: string;
    ends_at: string;
    all_day: boolean;
    location: string | null;
    html_link: string | null;
  }[] = [];

  let pageToken: string | undefined;
  for (let page = 0; page < 5; page += 1) {
    const params = new URLSearchParams({
      timeMin: windowStart.toISOString(),
      timeMax: windowEnd.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await googleFetch(token, `${API}?${params.toString()}`);
    if (!response.ok) return;
    const data = (await response.json()) as { items?: GoogleListedEvent[]; nextPageToken?: string };
    for (const item of data.items ?? []) {
      if (item.status === "cancelled" || item.extendedProperties?.private?.[HQ_KEY]) continue;
      const allDay = Boolean(item.start?.date);
      const start = item.start?.dateTime ?? (item.start?.date ? fortalezaToIso(item.start.date, "00:00") : null);
      const endRaw = item.end?.dateTime ?? (item.end?.date ? fortalezaToIso(addDaysIso(item.end.date, -1), "23:59") : null);
      if (!start || !endRaw) continue;
      rows.push({
        profile_id: profileId,
        google_event_id: item.id,
        title: item.summary?.trim() || "(Sem título)",
        starts_at: new Date(start).toISOString(),
        ends_at: new Date(endRaw).toISOString(),
        all_day: allDay,
        location: item.location ?? null,
        html_link: item.htmlLink ?? null,
      });
    }
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  await admin.from("google_calendar_events").delete().eq("profile_id", profileId);
  if (rows.length > 0) await admin.from("google_calendar_events").insert(rows);
}

/** Sincroniza todas as contas conectadas (job a cada 15 min). */
export async function syncAllGoogleAccounts(): Promise<number> {
  const admin = createAdminClient();
  const { data } = await admin.from("google_accounts").select("profile_id");
  let total = 0;
  for (const row of data ?? []) {
    const stats = await syncGoogleForProfile(row.profile_id);
    total += stats.created + stats.updated + stats.deleted;
  }
  return total;
}

/** Depois de uma mudança na agenda: sincroniza só quem tem conta entre as pessoas afetadas. */
export async function syncGoogleForProfiles(profileIds: readonly string[]): Promise<void> {
  if (!googleConfigured() || profileIds.length === 0) return;
  const admin = createAdminClient();
  const { data } = await admin.from("google_accounts").select("profile_id").in("profile_id", [...new Set(profileIds)]);
  for (const row of data ?? []) await syncGoogleForProfile(row.profile_id);
}
