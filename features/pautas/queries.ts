import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PautaWithDetails } from "@/types";
import type {
  PautaCommentDetail,
  PautaDetail,
  PautaFilters,
  PautaFormOptions,
  PautaHistoryEntry,
  PautaMemberDetail,
  PautaLogEntry,
} from "@/features/pautas/types";

/**
 * A RLS de `pautas`/`pautas_with_details` já decide, linha a linha, quem vê o quê. Tarefas
 * avulsas (is_standalone) nunca aparecem aqui — são pessoais, só existem no quadro pessoal
 * (/minhas-pautas), mesmo para quem as criou.
 */
export async function listPautas(filters: PautaFilters): Promise<PautaWithDetails[]> {
  const supabase = await createClient();
  let query = supabase
    .from("pautas_with_details")
    .select("*")
    .eq("is_standalone", false)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (filters.projectIds?.length) query = query.in("project_id", filters.projectIds);
  if (filters.leadIds?.length) query = query.in("lead_id", filters.leadIds);
  if (filters.assigneeIds?.length) query = query.in("current_assignee_id", filters.assigneeIds);
  if (filters.companyIds?.length) query = query.in("company_id", filters.companyIds);
  if (filters.priorities?.length) query = query.in("priority", filters.priorities);
  if (filters.statuses?.length) query = query.in("status", filters.statuses);
  if (filters.squads?.length) query = query.in("squad", filters.squads);
  if (filters.search?.trim()) query = query.ilike("title", `%${filters.search.trim().replace(/[%_\\]/g, (char) => `\\${char}`)}%`);

  const { data, error } = await query;
  if (error) {
    // O motivo real (código e mensagem do banco) fica no log do servidor; a tela mostra o genérico.
    console.error("listPautas:", error.code, error.message, error.details ?? "", error.hint ?? "");
    throw new Error("Falha ao carregar as pautas.");
  }
  return data ?? [];
}

/** Opções para os formulários de pauta (nova pauta, handover). Sem dados financeiros. */
export async function getPautaFormOptions(): Promise<PautaFormOptions> {
  const supabase = await createClient();
  const [companies, projects, members, contacts, freelancers] = await Promise.all([
    supabase.from("companies").select("id, name, logo_url").order("name"),
    supabase.from("projects").select("id, name, company_id, is_internal").order("name"),
    supabase.from("profiles").select("id, full_name, avatar_url").eq("is_active", true).neq("full_name", "").order("full_name"),
    supabase.from("contacts").select("id, company_id, full_name").order("full_name"),
    supabase.from("freelancers").select("id, full_name, functions").eq("is_active", true).order("full_name"),
  ]);
  return {
    companies: companies.data ?? [],
    freelancers: freelancers.data ?? [],
    projects: projects.data ?? [],
    members: members.data ?? [],
    contacts: contacts.data ?? [],
  };
}

export async function getPautaDetail(id: string): Promise<PautaDetail | null> {
  const supabase = await createClient();
  const [pautaResult, membersResult, commentsResult, historyResult, logsResult] = await Promise.all([
    supabase.from("pautas_with_details").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("pauta_members")
      .select("profile_id, production_function, profile:profiles!pauta_members_profile_id_fkey(id, full_name, avatar_url)")
      .eq("pauta_id", id)
      .order("added_at"),
    supabase
      .from("pauta_comments")
      .select("id, body, created_at, edited_at, author_id, author:profiles(id, full_name, avatar_url)")
      .eq("pauta_id", id)
      .order("created_at"),
    supabase
      .from("pauta_status_history")
      .select(
        "id, from_status, to_status, from_assignee, to_assignee, note, created_at, changed_by_profile:profiles!pauta_status_history_changed_by_fkey(full_name), to_assignee_profile:profiles!pauta_status_history_to_assignee_fkey(full_name)",
      )
      .eq("pauta_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("pauta_logs")
      .select("id, kind, body, link_url, status, created_at, author_id, author:profiles!pauta_logs_author_id_fkey(id, full_name, avatar_url)")
      .eq("pauta_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (!pautaResult.data) return null;

  const members: PautaMemberDetail[] = (membersResult.data ?? []).map((row) => ({
    profile_id: row.profile_id,
    production_function: row.production_function,
    profile: row.profile,
  }));

  const comments: PautaCommentDetail[] = (commentsResult.data ?? []).map((row) => ({
    id: row.id,
    body: row.body,
    created_at: row.created_at,
    edited_at: row.edited_at,
    author_id: row.author_id,
    author: row.author,
  }));

  const history: PautaHistoryEntry[] = (historyResult.data ?? []).map((row) => ({
    id: row.id,
    from_status: row.from_status,
    to_status: row.to_status,
    from_assignee: row.from_assignee,
    to_assignee: row.to_assignee,
    note: row.note,
    created_at: row.created_at,
    changed_by_name: row.changed_by_profile?.full_name ?? null,
    to_assignee_name: row.to_assignee_profile?.full_name ?? null,
  }));

  const logs: PautaLogEntry[] = (logsResult.data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    body: row.body,
    link_url: row.link_url,
    status: row.status,
    created_at: row.created_at,
    author_id: row.author_id,
    author: row.author,
  }));

  return { pauta: pautaResult.data, members, comments, history, logs };
}
