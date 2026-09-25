import "server-only";
import { createClient } from "@/lib/supabase/server";
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
  const memberOnlyResult = memberPautaIds.length > 0 ? await supabase.from("pautas_with_details").select("*").in("id", memberPautaIds) : null;

  const byId = new Map<string, PautaWithDetails>();
  for (const row of [...(linkedResult.data ?? []), ...(memberOnlyResult?.data ?? [])]) {
    if (row.id) byId.set(row.id, row);
  }

  const board: MyPautasBoard = { atrasadas: [], hoje: [], estaSemana: [], depois: [], acompanhando: [], devolvidas: devolvidasResult.data ?? [] };

  for (const pauta of byId.values()) {
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
