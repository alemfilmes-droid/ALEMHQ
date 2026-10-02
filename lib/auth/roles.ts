import type { AccessRole, ProductionFunction, Squad } from "@/types";

export const ACCESS_ROLES = [
  "admin",
  "coordinator",
  "member",
  "freelancer",
  "sdr",
  "bdr",
] as const satisfies readonly AccessRole[];

export const PRODUCTION_FUNCTIONS = [
  "captacao",
  "edicao",
  "direcao",
  "roteiro",
  "motion",
  "producao",
  "fotografia",
] as const satisfies readonly ProductionFunction[];

export const ROLE_LABELS: Record<AccessRole, string> = {
  admin: "Administração",
  coordinator: "Coordenação",
  member: "Membro",
  freelancer: "Freelancer",
  sdr: "SDR",
  bdr: "BDR",
};

/** Atuação de uma pessoa em Equipe: só as funções de produção. */
export type AtuacaoFunction = (typeof PRODUCTION_FUNCTIONS)[number];

export function isAtuacaoFunction(value: ProductionFunction): value is AtuacaoFunction {
  return (PRODUCTION_FUNCTIONS as readonly string[]).includes(value);
}

/**
 * Rótulo de qualquer função/atividade — as de produção (Atuação) e as atividades de pauta dos outros
 * squads (o enum production_function do banco cobre as duas).
 */
export const FUNCTION_LABELS: Record<ProductionFunction, string> = {
  captacao: "Captação",
  edicao: "Edição",
  direcao: "Direção",
  roteiro: "Roteiro",
  motion: "Motion",
  producao: "Produção",
  fotografia: "Fotografia",
  ajuste_crm: "Ajuste no CRM",
  prospeccao: "Prospecção",
  follow_up: "Follow-up",
  proposta: "Proposta",
  reuniao_comercial: "Reunião comercial",
  relatorio_comercial: "Relatório comercial",
  cobranca: "Cobrança",
  conciliacao: "Conciliação",
  pagamentos: "Pagamentos",
  nota_fiscal: "Nota fiscal",
  orcamento: "Orçamento",
  relatorio_financeiro: "Relatório financeiro",
  aprovacao: "Aprovação",
  planejamento_estrategico: "Planejamento estratégico",
  revisao: "Revisão",
  reuniao: "Reunião",
  contratacao: "Contratação",
  relatorio_gerencial: "Relatório gerencial",
  outro: "Outro",
};

/** O que cada squad faz numa pauta/tarefa — a lista do "responsável" muda conforme o squad escolhido. */
export const PAUTA_ACTIVITIES_BY_SQUAD: Record<Squad, readonly ProductionFunction[]> = {
  audiovisual: [...PRODUCTION_FUNCTIONS, "revisao", "outro"],
  comercial: ["ajuste_crm", "prospeccao", "follow_up", "proposta", "reuniao_comercial", "relatorio_comercial", "revisao", "outro"],
  financeiro: ["cobranca", "conciliacao", "pagamentos", "nota_fiscal", "orcamento", "relatorio_financeiro", "revisao", "outro"],
  diretoria: ["aprovacao", "planejamento_estrategico", "revisao", "reuniao", "contratacao", "relatorio_gerencial", "outro"],
};

/** Todas as atividades possíveis numa pauta (validação do "passar adiante" e dos responsáveis). */
export const PAUTA_ACTIVITIES = Array.from(new Set(Object.values(PAUTA_ACTIVITIES_BY_SQUAD).flat())) as ProductionFunction[];

/** Atividade padrão de um squad (o primeiro item da lista). */
export function defaultActivityFor(squad: Squad): ProductionFunction {
  return PAUTA_ACTIVITIES_BY_SQUAD[squad][0] ?? "outro";
}
