import type { PautaBoard, PautasSummary } from "@/features/pautas/types";
import { isPautaOverdue } from "@/lib/pautas";
import type { PautaWithDetails } from "@/types";

/** Puro, sem dependência de servidor — usado no client (KanbanBoard) e no server (página). */
export function groupPautasByColumn(pautas: PautaWithDetails[]): PautaBoard {
  const board: PautaBoard = { sprint_backlog: [], em_andamento: [], revisao: [], entregue: [] };
  for (const pauta of pautas) {
    if (pauta.board_column) board[pauta.board_column].push(pauta);
  }
  return board;
}

/**
 * Contadores do topo do quadro, calculados a partir da lista já filtrada — espelha
 * exatamente a RPC `pautas_summary` do banco (em_andamento = coluna, concluidas =
 * entregue, criticas = crítica ou atrasada), sem round-trip extra ao servidor.
 */
export function summarizePautas(pautas: PautaWithDetails[]): PautasSummary {
  let emAndamento = 0;
  let concluidas = 0;
  let criticas = 0;
  for (const pauta of pautas) {
    if (pauta.board_column === "em_andamento") emAndamento += 1;
    if (pauta.board_column === "entregue") concluidas += 1;
    const overdue = pauta.due_date ? isPautaOverdue(pauta.due_date, pauta.board_column!) : false;
    if (pauta.is_critical || overdue) criticas += 1;
  }
  return { emAndamento, concluidas, criticas };
}
