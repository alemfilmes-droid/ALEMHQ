import { TINTS, type Tint } from "@/lib/theme/tint";
import type { ProjectModel, ProjectStage } from "@/types";

/**
 * Cores de Projetos — fonte única (lista, quadro, página do cliente, cabeçalho do cliente e do projeto).
 * Degradês suaves de lib/theme/tint (contraste AA conferido em tint.test.ts), nunca cor chapada nem o
 * vermelho da marca.
 */

export const PROJECT_MODEL_TINT: Record<ProjectModel, Tint> = {
  recorrente: TINTS.violetIndigo,
  transacional: TINTS.tealCyan,
};

/** Família de cor de cada etapa. */
export type ProjectStatusFamily = "pre_producao" | "captacao" | "pos_producao" | "aprovacao" | "ativo" | "encerrado" | "churn";

export const PROJECT_STATUS_TINT: Record<ProjectStatusFamily, Tint> = {
  pre_producao: TINTS.blue,
  captacao: TINTS.amber,
  pos_producao: TINTS.purple,
  aprovacao: TINTS.yellow,
  ativo: TINTS.green,
  encerrado: TINTS.gray,
  churn: TINTS.rose,
};

export const PROJECT_STAGE_FAMILY: Record<ProjectStage, ProjectStatusFamily> = {
  planejamento: "pre_producao",
  pre_producao: "pre_producao",
  captacao: "captacao",
  producao: "captacao",
  edicao: "pos_producao",
  revisao_interna: "pos_producao",
  alteracao: "pos_producao",
  aprovacao_cliente: "aprovacao",
  entregue: "ativo",
  pausado: "encerrado",
  cancelado: "encerrado",
  encerrado: "encerrado",
};

export function projectStageTint(stage: ProjectStage): Tint {
  return PROJECT_STATUS_TINT[PROJECT_STAGE_FAMILY[stage]];
}

/**
 * Modelo do cliente (cabeçalho): Recorrente se tem algum projeto recorrente em aberto; senão Transacional se tem
 * projeto; sem projetos, nenhum.
 */
export function clientModelOf(projects: readonly { model: ProjectModel; stage: ProjectStage }[]): ProjectModel | null {
  if (projects.length === 0) return null;
  const open = projects.filter((project) => PROJECT_STAGE_FAMILY[project.stage] !== "encerrado" && PROJECT_STAGE_FAMILY[project.stage] !== "churn");
  return open.some((project) => project.model === "recorrente") ? "recorrente" : "transacional";
}
