import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MyOpenRequest } from "@/features/crm/types";
import type { MyPautasBoard } from "@/features/minhas-pautas/types";
import { bucketMyPautas } from "@/lib/my-pautas";
import type { PautaWithDetails } from "@/types";

/**
 * Quadro pessoal: pautas onde a pessoa é líder, responsável atual ou membro, mais tarefas
 * avulsas (que já entram por lead_id/current_assignee_id = ela mesma). A RLS decide quem vê o
 * quê; aqui só agrupamos (bucketMyPautas, a mesma regra que a tela usa depois de mover uma pauta):
 * com a bola em outra pessoa a pauta vai para "Acompanhando"; o resto vai por prazo (due_date).
 */
export async function getMyPautasBoard(profileId: string): Promise<MyPautasBoard> {
  const supabase = await createClient();

  const [linkedResult, memberRowsResult, devolvidasResult] = await Promise.all([
    supabase.from("pautas_with_details").select("*").or(`lead_id.eq.${profileId},current_assignee_id.eq.${profileId}`),
    supabase.from("pauta_members").select("pauta_id").eq("profile_id", profileId),
    supabase
      .from("pautas_with_details")
      .select("*")
      .eq("previous_assignee_id", profileId)
      .gte("returned_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
  ]);

  const memberPautaIds = (memberRowsResult.data ?? []).map((row) => row.pauta_id);
  // Pedido de direcionamento aberto para mim: a pauta do negócio entra no meu quadro até eu resolver.
  const { data: requestRows } = await supabase
    .from("deal_notes")
    .select("deal_id")
    .eq("assigned_to", profileId)
    .eq("is_request", true)
    .is("resolved_at", null);
  const requestDealIds = Array.from(new Set((requestRows ?? []).map((row) => row.deal_id)));
  const [memberOnlyResult, requestPautasResult] = await Promise.all([
    memberPautaIds.length > 0 ? supabase.from("pautas_with_details").select("*").in("id", memberPautaIds) : null,
    requestDealIds.length > 0 ? supabase.from("pautas_with_details").select("*").eq("source", "crm").in("deal_id", requestDealIds) : null,
  ]);

  const byId = new Map<string, PautaWithDetails>();
  for (const row of [...(linkedResult.data ?? []), ...(memberOnlyResult?.data ?? []), ...(requestPautasResult?.data ?? [])]) {
    if (row.id) byId.set(row.id, row);
  }

  // Passou adiante mas continua na pauta: ela já aparece em "Acompanhando" — não repete em Devolvidas.
  const devolvidas = (devolvidasResult.data ?? []).filter((pauta) => !pauta.id || !byId.has(pauta.id)).sort((a, b) => (b.returned_at ?? "").localeCompare(a.returned_at ?? ""));
  return { ...bucketMyPautas([...byId.values()], { profileId, requestDealIds }), devolvidas, requestDealIds };
}

export interface HomePautaSummary {
  atrasadas: number;
  hoje: number;
  nextDue: { id: string; title: string; dueDate: string | null } | null;
}

/** Resumo compacto para o card "Minhas Pautas" da home. */
export async function getHomePautaSummary(profileId: string): Promise<HomePautaSummary> {
  const board = await getMyPautasBoard(profileId);
  const pending = [...board.atrasadas, ...board.hoje, ...board.estaSemana, ...board.depois];
  const nextDue = pending.find((pauta) => pauta.due_date) ?? pending[0] ?? null;

  return {
    atrasadas: board.atrasadas.length,
    hoje: board.hoje.length,
    nextDue: nextDue?.id && nextDue.title ? { id: nextDue.id, title: nextDue.title, dueDate: nextDue.due_date } : null,
  };
}

/** Pedidos de direcionamento abertos para a pessoa, com a pauta do negócio para abrir direto. */
export async function getMyOpenRequests(profileId: string): Promise<MyOpenRequest[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("deal_notes")
    .select("id, body, due_at, created_at, deal_id, author:profiles!deal_notes_author_id_fkey(full_name)")
    .eq("assigned_to", profileId)
    .eq("is_request", true)
    .is("resolved_at", null)
    .order("created_at", { ascending: false });
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const dealIds = Array.from(new Set(rows.map((row) => row.deal_id)));
  const { data: pautas } = await supabase.from("pautas_with_details").select("id, deal_id, title").eq("source", "crm").in("deal_id", dealIds);
  const byDeal = new Map((pautas ?? []).map((pauta) => [pauta.deal_id, pauta]));

  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    dueAt: row.due_at,
    createdAt: row.created_at,
    authorName: row.author?.full_name ?? null,
    dealId: row.deal_id,
    pautaId: byDeal.get(row.deal_id)?.id ?? null,
    title: byDeal.get(row.deal_id)?.title ?? "Negócio",
  }));
}
