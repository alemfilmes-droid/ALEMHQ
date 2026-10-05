import type { Database } from "@/types/database";
import type { Squad } from "@/types";

export type ProcessFrequency = Database["public"]["Enums"]["process_frequency"];
export type ProcessSystemArea = Database["public"]["Enums"]["process_system_area"];

export const PROCESS_FREQUENCIES = ["sob_demanda", "diaria", "semanal", "mensal", "trimestral"] as const satisfies readonly ProcessFrequency[];
export const FREQUENCY_LABELS: Record<ProcessFrequency, string> = {
  sob_demanda: "Sob demanda",
  diaria: "Diária",
  semanal: "Semanal",
  mensal: "Mensal",
  trimestral: "Trimestral",
};

export const SYSTEM_AREAS = [
  "clientes",
  "projetos",
  "pautas",
  "crm",
  "financeiro",
  "agenda",
  "equipe",
  "banco_de_horas",
  "avisos",
  "externo",
  "nenhum",
] as const satisfies readonly ProcessSystemArea[];

export const SYSTEM_AREA_LABELS: Record<ProcessSystemArea, string> = {
  clientes: "Clientes",
  projetos: "Projetos",
  pautas: "Pautas",
  crm: "CRM",
  financeiro: "Financeiro",
  agenda: "Agenda",
  equipe: "Equipe",
  banco_de_horas: "Banco de Horas",
  avisos: "Avisos",
  externo: "Sistema externo",
  nenhum: "Fora do sistema",
};

/** Rota padrão de cada área (quando o passo não tem link próprio). */
export const SYSTEM_AREA_ROUTES: Partial<Record<ProcessSystemArea, string>> = {
  clientes: "/clientes",
  projetos: "/projetos",
  pautas: "/minhas-pautas",
  crm: "/crm",
  financeiro: "/financeiro",
  agenda: "/agenda",
  equipe: "/equipe",
  banco_de_horas: "/banco-de-horas",
  avisos: "/avisos",
};

export const STEP_TOOLS = ["pasta_drive", "arvore_drive", "arquivo_nota_fiscal"] as const;
export type StepTool = (typeof STEP_TOOLS)[number];
export const STEP_TOOL_LABELS: Record<StepTool, string> = {
  pasta_drive: "Gerador da pasta do Drive",
  arvore_drive: "Árvore de pastas do projeto",
  arquivo_nota_fiscal: "Caminho e nome do PDF da nota",
};

/** Tipo do passo: decisão tem saídas "Sim" e "Não"; aprovação e espera mudam o desenho. */
export const STEP_TYPES = ["acao", "decisao", "aprovacao", "espera"] as const;
export type StepType = (typeof STEP_TYPES)[number];
export const STEP_TYPE_LABELS: Record<StepType, string> = { acao: "Ação", decisao: "Decisão", aprovacao: "Aprovação", espera: "Espera" };

/** O tipo de ação define o ícone do passo (ver features/processes/icons.ts). */
export const ACTION_KINDS = ["copiar", "conferir", "acessar", "emitir", "enviar", "salvar", "registrar", "aprovar", "aguardar", "decidir", "executar"] as const;
export type ActionKind = (typeof ACTION_KINDS)[number];
export const ACTION_KIND_LABELS: Record<ActionKind, string> = {
  copiar: "Copiar dados",
  conferir: "Conferir",
  acessar: "Acessar sistema externo",
  emitir: "Emitir / produzir",
  enviar: "Enviar",
  salvar: "Salvar arquivo",
  registrar: "Registrar no HQ",
  aprovar: "Aprovar",
  aguardar: "Aguardar",
  decidir: "Decidir",
  executar: "Executar",
};

export interface ProcessStepItem {
  id: string;
  orderIndex: number;
  title: string;
  description: string | null;
  responsibleRole: string | null;
  systemArea: ProcessSystemArea;
  systemLink: string | null;
  doneCriteria: string | null;
  estimatedMinutes: number | null;
  isBlocking: boolean;
  tool: StepTool | null;
  archived: boolean;
  stepType: StepType;
  actionKind: ActionKind;
  branchYesStepId: string | null;
  branchNoStepId: string | null;
  imageUrl: string | null;
  exampleText: string | null;
}

/** O passo acontece dentro do Além HQ (link interno) — e não num sistema externo. */
export function isInsideHq(step: Pick<ProcessStepItem, "systemArea" | "systemLink">): boolean {
  if (step.systemArea === "externo") return false;
  const target = stepHref(step);
  return target !== null && !target.external;
}

export interface ProcessSummary {
  id: string;
  slug: string;
  title: string;
  squad: Squad;
  summary: string | null;
  triggerDescription: string | null;
  frequency: ProcessFrequency;
  ownerRole: string | null;
  orderIndex: number;
  isPublished: boolean;
  archived: boolean;
  stepCount: number;
  /** Texto dos passos (títulos e descrições) para a busca. */
  searchText: string;
}

export interface ProcessDetail extends Omit<ProcessSummary, "stepCount" | "searchText"> {
  steps: ProcessStepItem[];
  updatedAt: string;
  updatedByName: string | null;
}

export interface ProcessRunItem {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  startedById: string;
  startedByName: string;
  contextLabel: string | null;
  contextEntityType: string | null;
  contextEntityId: string | null;
  done: { stepId: string; doneAt: string; doneByName: string | null }[];
}

/** Destino do passo: o link próprio ou a rota da área. Externo abre em nova aba. */
export function stepHref(step: Pick<ProcessStepItem, "systemArea" | "systemLink">): { href: string; external: boolean } | null {
  const href = step.systemLink ?? SYSTEM_AREA_ROUTES[step.systemArea] ?? null;
  if (!href) return null;
  return { href, external: /^https?:\/\//i.test(href) };
}
