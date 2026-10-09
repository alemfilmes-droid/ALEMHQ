import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MyOpenRequest } from "@/features/crm/types";
import type { MyPautasBoard } from "@/features/minhas-pautas/types";
import { pautaUrgency } from "@/lib/pautas";
import type { PautaWithDetails } from "@/types";

function sortByDueDate(rows: PautaWithDetails[]): PautaWithDetails[] {
  return [...rows].sort((a, b) => (a.due_date ?? "9999-99-99").localeCompare(b.due_date ?? "9999-99-99"));
}

/**
 * Quadro pessoal: pautas onde a pessoa é líder, responsável atual ou membro, mais tarefas
 * avulsas (que já entram por lead_id/current_assignee_id = ela mesma). A RLS decide quem vê o
 * quê; aqui só agrupamos por urgência/papel. "Acompanhando" (lidera, mas não está com a bola) sai
 * dos grupos de urgência para o seu próprio grupo; o resto some por prazo (due_date).
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

  const board: MyPautasBoard = {
    atrasadas: [],
    hoje: [],
    estaSemana: [],
    depois: [],
    acompanhando: [],
    devolvidas: devolvidasResult.data ?? [],
    entregues: [],
  };

  for (const pauta of byId.values()) {
    // Entregue/aprovada já terminou: nunca entra em "atrasadas", "hoje" etc., só no grupo próprio.
    if (pauta.board_column === "entregue" || pauta.status === "aprovado") {
      board.entregues.push(pauta);
      continue;
    }
    if (pauta.lead_id === profileId && pauta.current_assignee_id !== profileId) {
      board.acompanhando.push(pauta);
      continue;
    }
    switch (pautaUrgency(pauta.due_date)) {
      case "atrasada":
        board.atrasadas.push(pauta);
        break;
      case "hoje":
        board.hoje.push(pauta);
        break;
      case "esta_semana":
        board.estaSemana.push(pauta);
        break;
      default:
        board.depois.push(pauta);
    }
  }

  board.atrasadas = sortByDueDate(board.atrasadas);
  board.hoje = sortByDueDate(board.hoje);
  board.estaSemana = sortByDueDate(board.estaSemana);
  board.depois = sortByDueDate(board.depois);
  board.acompanhando = sortByDueDate(board.acompanhando);
  // As 50 entregues mais recentes bastam para consulta rápida; o histórico completo está no projeto.
  board.entregues = [...board.entregues].sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? "")).slice(0, 50);
  board.devolvidas = [...board.devolvidas].sort((a, b) => (b.returned_at ?? "").localeCompare(a.returned_at ?? ""));

  return board;
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
