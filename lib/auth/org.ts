import type { OrgLevel } from "@/types";

export const ORG_LEVELS = ["master", "diretoria", "head", "executor"] as const satisfies readonly OrgLevel[];

export const ORG_LEVEL_LABELS: Record<OrgLevel, string> = {
  master: "Master",
  diretoria: "Diretoria",
  head: "Head",
  executor: "Executor",
};

/** Sugestões de cargo exibidas no autocomplete — o campo continua aceitando texto livre. */
export const ROLE_TITLE_SUGGESTIONS = [
  "CEO",
  "COO",
  "CFO",
  "CCO",
  "Head Comercial",
  "Head Financeiro",
  "Head de Audiovisual",
  "Filmmaker",
  "Editor",
  "Fotógrafo",
  "Designer",
  "Piloto de drone",
  "Freelancer",
  "SDR",
  "BDR",
  "Atendimento",
  "Analista financeiro",
  "Auxiliar financeiro",
  "Assistente financeiro",
] as const;
