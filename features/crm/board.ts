import type { DealBoard, StageColumnSummary } from "@/features/crm/types";
import { toCents } from "@/features/finance/money";
import type { DealStage, DealWithDetails } from "@/types";

/** Puro, sem dependência de servidor — usado no client (DealKanbanBoard) e no server (página). */
export function groupDealsByStage(deals: DealWithDetails[]): DealBoard {
  const board: DealBoard = {
    prospeccao: [],
    primeiro_contato: [],
    tentativas_contato: [],
    qualificado: [],
    reuniao_agendada: [],
    reuniao_realizada: [],
    proposta_enviada: [],
    negociacao: [],
    ganho: [],
    perdido: [],
  };
  for (const deal of deals) {
    if (deal.stage) board[deal.stage].push(deal);
  }
  return board;
}

/** Contagem e soma do valor estimado por coluna, para o cabeçalho do funil. */
export function summarizeStage(deals: DealWithDetails[]): StageColumnSummary {
  return {
    count: deals.length,
    totalValue: deals.reduce((total, deal) => total + toCents(deal.estimated_value), 0),
  };
}

export function isDealOverdue(nextActionAt: string | null): boolean {
  return nextActionAt !== null && new Date(nextActionAt).getTime() < Date.now();
}

/** Espelha deal_stage_rank() do banco — só para decidir, no client, se um efeito colateral (ex.: reunião concluída) regrediria o funil. */
const STAGE_RANK: Record<DealStage, number> = {
  prospeccao: 0,
  primeiro_contato: 1,
  tentativas_contato: 2,
  qualificado: 3,
  reuniao_agendada: 4,
  reuniao_realizada: 5,
  proposta_enviada: 6,
  negociacao: 7,
  ganho: 8,
  perdido: 8,
};

export function dealStageRank(stage: DealStage): number {
  return STAGE_RANK[stage];
}
