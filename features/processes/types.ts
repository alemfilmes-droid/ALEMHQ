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

export const STEP_TOOLS = ["pasta_drive"] as const;
export type StepTool = (typeof STEP_TOOLS)[number];
export const STEP_TOOL_LABELS: Record<StepTool, string> = { pasta_drive: "Gerador da pasta do Drive" };

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
