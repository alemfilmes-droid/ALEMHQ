import type { ClientTier, CompanyLifecycle, CompanySource, ProjectModel, ProjectPriority, ProjectStage, ServiceType } from "@/types";

/** Situações escolhíveis no formulário. "Ex-cliente" só entra pelo encerramento (e sai por "Reativar cliente"). */
export const COMPANY_LIFECYCLES = ["client", "prospect"] as const satisfies readonly CompanyLifecycle[];
export const ALL_COMPANY_LIFECYCLES = ["client", "prospect", "former_client"] as const satisfies readonly CompanyLifecycle[];

export const COMPANY_SOURCES = [
  "crm",
  "indicacao",
  "cliente_antigo",
  "instagram",
  "site",
  "evento",
  "prospeccao_ativa",
  "outro",
] as const satisfies readonly CompanySource[];

export const PROJECT_STAGES = [
  "planejamento",
  "pre_producao",
  "captacao",
  "producao",
  "edicao",
  "revisao_interna",
  "aprovacao_cliente",
  "alteracao",
  "entregue",
  "pausado",
  "cancelado",
] as const satisfies readonly ProjectStage[];

/** Todas as etapas, inclusive "Encerrado" — que só entra pelo encerramento (não aparece no seletor). */
export const ALL_PROJECT_STAGES = [...PROJECT_STAGES, "encerrado"] as const satisfies readonly ProjectStage[];

export const LIFECYCLE_LABELS: Record<CompanyLifecycle, string> = {
  client: "Cliente",
  prospect: "Prospect",
  former_client: "Ex-cliente",
};

export const SOURCE_LABELS: Record<CompanySource, string> = {
  crm: "CRM",
  indicacao: "Indicação",
  cliente_antigo: "Cliente antigo",
  instagram: "Instagram",
  site: "Site",
  evento: "Evento",
  prospeccao_ativa: "Prospecção ativa",
  outro: "Outro",
};

export const STAGE_LABELS: Record<ProjectStage, string> = {
  planejamento: "Planejamento",
  pre_producao: "Pré-produção",
  captacao: "Captação",
  producao: "Produção",
  edicao: "Edição",
  revisao_interna: "Revisão interna",
  aprovacao_cliente: "Aprovação do cliente",
  alteracao: "Alteração",
  entregue: "Entregue",
  pausado: "Pausado",
  cancelado: "Cancelado",
  encerrado: "Encerrado",
};

export const INTERNAL_PROJECT_LABEL = "Interno — Além Filmes";

export const MODEL_LABELS: Record<ProjectModel, string> = {
  transacional: "Transacional",
  recorrente: "Recorrente",
};

export const PRIORITY_LABELS: Record<ProjectPriority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  captacao: "Captação",
  edicao: "Edição",
  direcao: "Direção",
  producao_completa: "Produção completa",
};

export const MODELS = ["transacional", "recorrente"] as const satisfies readonly ProjectModel[];
export const PRIORITIES = ["baixa", "media", "alta", "urgente"] as const satisfies readonly ProjectPriority[];
export const SERVICE_TYPES = [
  "captacao",
  "edicao",
  "direcao",
  "producao_completa",
] as const satisfies readonly ServiceType[];

export const TIERS = ["low_ticket", "mid_ticket", "high_ticket"] as const satisfies readonly ClientTier[];

export const TIER_LABELS: Record<ClientTier, string> = {
  low_ticket: "Low Ticket",
  mid_ticket: "Mid Ticket",
  high_ticket: "High Ticket",
};
