import type { ProjectStage } from "@/types";

/**
 * Quadro de Projetos: Ativos, Encerrados e Churn. Espelha public.project_board_column / project_board_move no
 * banco (mesmos casos em board-cases.json, conferidos lá), que valida de novo e registra cada movimento.
 */

export const BOARD_COLUMNS = ["ativos", "encerrados", "churn"] as const;
export type BoardColumn = (typeof BOARD_COLUMNS)[number];

export const BOARD_COLUMN_LABELS: Record<BoardColumn, string> = {
  ativos: "Ativos",
  encerrados: "Encerrados",
  churn: "Churn",
};

export function boardColumnOf(stage: ProjectStage): BoardColumn {
  if (stage === "churn") return "churn";
  if (stage === "encerrado" || stage === "cancelado") return "encerrados";
  return "ativos";
}

/** Filtro "Somente ativos" (padrão da lista). */
export function isActiveProject(stage: ProjectStage): boolean {
  return boardColumnOf(stage) === "ativos";
}

/** Etapas fora de "Ativos" (para o filtro no banco). */
export const INACTIVE_STAGES: readonly ProjectStage[] = ["encerrado", "cancelado", "churn"];

export const MIN_CHURN_REASON = 3;

export type MoveCheck =
  | { kind: "noop" }
  | { kind: "needs_reason" }
  | { kind: "needs_confirmation" }
  | { kind: "ok" };

/**
 * O que a tela precisa antes de mover: nada (mesma coluna), o motivo (Churn, obrigatório) ou a confirmação
 * (Encerrar). Voltar para Ativos é direto.
 */
export function checkMove(stage: ProjectStage, to: BoardColumn, input: { reason?: string; confirmed?: boolean } = {}): MoveCheck {
  if (boardColumnOf(stage) === to) return { kind: "noop" };
  if (to === "churn" && (input.reason ?? "").trim().length < MIN_CHURN_REASON) return { kind: "needs_reason" };
  if (to === "encerrados" && !input.confirmed) return { kind: "needs_confirmation" };
  return { kind: "ok" };
}

/** Etapa depois do movimento (voltar para Ativos devolve a etapa de antes; sem ela, Pré-produção). */
export function stageAfterMove(to: BoardColumn, stageBeforeClose: ProjectStage | null): ProjectStage {
  if (to === "churn") return "churn";
  if (to === "encerrados") return "encerrado";
  return stageBeforeClose ?? "pre_producao";
}
