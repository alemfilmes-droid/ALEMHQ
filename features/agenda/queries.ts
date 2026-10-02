import "server-only";
import { z } from "zod";
import type { AgendaEvent, AgendaFormOptions, CommitmentFormRow, ExternalAttendee } from "@/features/agenda/types";
import { createClient } from "@/lib/supabase/server";
import type { AgendaFeedRow } from "@/types";
import type { Json } from "@/types/database";

const externalSchema = z.array(z.object({ name: z.string().optional(), email: z.string().optional() }));

export function parseExternalAttendees(value: Json | null): ExternalAttendee[] {
  const parsed = externalSchema.safeParse(value);
  return parsed.success ? parsed.data.map((item) => ({ name: item.name ?? "", email: item.email ?? "" })) : [];
}

// O gerador de tipos marca todas as colunas de RETURNS TABLE como não nulas; aqui o nulo é tratado.
function mapFeedRow(row: AgendaFeedRow): AgendaEvent {
  return {
    key: row.event_key,
    source: row.source === "pauta" ? "pauta" : "commitment",
    commitmentId: row.commitment_id ?? null,
    pautaId: row.pauta_id ?? null,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    allDay: row.all_day,
    title: row.title,
    kind: row.kind,
    status: row.status,
    busyOnly: row.busy_only,
    visibility: row.visibility,
    ownerId: row.owner_id,
    ownerName: row.owner_name ?? "—",
    attendees: row.attendees ?? [],
    externalAttendees: parseExternalAttendees(row.external_attendees),
    location: row.location_or_link ?? null,
    notes: row.notes ?? null,
    companyId: row.company_id ?? null,
    companyName: row.company_name ?? null,
    companyLogoUrl: row.company_logo_url ?? null,
    projectId: row.project_id ?? null,
    projectName: row.project_name ?? null,
    dealId: row.deal_id ?? null,
    recurrenceRule: row.recurrence_rule ?? null,
    reminderMinutes: row.reminder_minutes ?? [],
    canEdit: row.can_edit,
    googleSyncStatus: row.google_sync_status,
  };
}

interface FeedParams {
  from: string;
  to: string;
  people?: string[];
  onlyMine?: boolean;
}

/**
 * Feed do calendário (agenda_feed): compromissos com recorrência expandida e privados de outras
 * pessoas como "Ocupado", mais as pautas agendadas do líder e dos responsáveis — tudo decidido no banco.
 */
export async function getAgendaEvents({ from, to, people, onlyMine = false }: FeedParams): Promise<AgendaEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("agenda_feed", {
    p_from: from,
    p_to: to,
    p_people: people && people.length > 0 ? people : undefined,
    p_only_mine: onlyMine,
  });
  if (error) throw new Error("Falha ao carregar a agenda.");
  const events = (data ?? []).map(mapFeedRow);

  // Eventos do Google da própria pessoa (a RLS só devolve os dela) — quando a visão inclui ela.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user && (!people || people.length === 0 || people.includes(user.id))) {
    const { data: google } = await supabase
      .from("google_calendar_events")
      .select("google_event_id, title, starts_at, ends_at, all_day, location, html_link")
      .lt("starts_at", to)
      .gt("ends_at", from);
    for (const row of google ?? []) {
      events.push({
        key: `g:${row.google_event_id}`,
        source: "google",
        externalUrl: row.html_link,
        commitmentId: null,
        pautaId: null,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        allDay: row.all_day,
        title: row.title,
        kind: "interno",
        status: "agendado",
        busyOnly: false,
        visibility: "privado",
        ownerId: user.id,
        ownerName: "Você",
        attendees: [],
        externalAttendees: [],
        location: row.location,
        notes: null,
        companyId: null,
        companyName: null,
        companyLogoUrl: null,
        projectId: null,
        projectName: null,
        dealId: null,
        recurrenceRule: null,
        reminderMinutes: [],
        canEdit: false,
        googleSyncStatus: "sincronizado",
      });
    }
    events.sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.endsAt.localeCompare(b.endsAt));
  }
  return events;
}

/** Próximos compromissos da pessoa (dono ou participante), para o card do início. */
export async function getUpcomingAgenda(limit = 3): Promise<AgendaEvent[]> {
  const now = new Date();
  const to = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const events = await getAgendaEvents({ from: now.toISOString(), to: to.toISOString(), onlyMine: true });
  return events.filter((event) => event.status === "agendado" && new Date(event.endsAt) > now).slice(0, limit);
}

/** Listas do formulário de compromisso — cada uma já filtrada pela RLS de quem abre. */
export async function getAgendaFormOptions(): Promise<AgendaFormOptions> {
  const supabase = await createClient();
  const [members, companies, projects, deals, pautas] = await Promise.all([
    supabase.from("profiles").select("id, full_name, avatar_url").eq("is_active", true).order("full_name"),
    supabase.from("companies").select("id, name, logo_url").order("name"),
    supabase.from("projects").select("id, name, company_id").not("stage", "in", "(entregue,cancelado)").order("name"),
    supabase.from("deals_with_details").select("id, title, company_id, company_name").not("stage", "in", "(ganho,perdido)").order("title").limit(300),
    supabase
      .from("pautas_with_details")
      .select("id, title, project_id, company_name, scheduled_at")
      .eq("is_standalone", false)
      .neq("board_column", "entregue")
      .order("title")
      .limit(300),
  ]);

  return {
    members: members.data ?? [],
    companies: companies.data ?? [],
    projects: projects.data ?? [],
    deals: (deals.data ?? []).flatMap((row) => (row.id && row.title ? [{ id: row.id, title: row.title, company_id: row.company_id, company_name: row.company_name }] : [])),
    pautas: (pautas.data ?? []).flatMap((row) =>
      row.id && row.title ? [{ id: row.id, title: row.title, project_id: row.project_id, company_name: row.company_name, scheduled_at: row.scheduled_at }] : [],
    ),
  };
}

/** Compromisso completo para edição — a RLS só devolve o que a pessoa pode ler. */
export async function getCommitmentForm(id: string): Promise<CommitmentFormRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("commitments").select("*").eq("id", id).maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    ownerId: data.owner_id,
    title: data.title,
    kind: data.kind,
    startsAt: data.starts_at,
    endsAt: data.ends_at,
    allDay: data.all_day,
    attendees: data.attendees,
    externalAttendees: parseExternalAttendees(data.external_attendees),
    location: data.location_or_link,
    notes: data.notes,
    companyId: data.company_id,
    projectId: data.project_id,
    dealId: data.deal_id,
    pautaId: data.pauta_id,
    reminderMinutes: data.reminder_minutes,
    visibility: data.visibility,
    recurrenceRule: data.recurrence_rule,
  };
}
