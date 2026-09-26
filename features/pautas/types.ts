import type { PautaColumn, PautaStatus, PautaWithDetails, ProductionFunction, ProjectPriority, Squad } from "@/types";

export interface PautaFilters {
  projectIds?: string[];
  leadIds?: string[];
  assigneeIds?: string[];
  companyIds?: string[];
  priorities?: ProjectPriority[];
  statuses?: PautaStatus[];
  squads?: Squad[];
  search?: string;
}

export interface PautasSummary {
  emAndamento: number;
  concluidas: number;
  criticas: number;
}

export interface PautaOptionMember {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

export interface PautaOptionProject {
  id: string;
  name: string;
  company_id: string | null;
  is_internal: boolean;
}

export interface PautaOptionContact {
  id: string;
  company_id: string;
  full_name: string;
}

export interface PautaOptionCompany {
  id: string;
  name: string;
  logo_url: string | null;
}

export interface PautaOptionFreelancer {
  id: string;
  full_name: string;
  functions: ProductionFunction[];
}

/** Listas usadas pelos formulários (cliente, projeto, pessoas, contatos, freelancers). Sem dados financeiros. */
export interface PautaFormOptions {
  /** Freelancers ativos (sem conta): só sinalizam com quem está a execução. */
  freelancers: PautaOptionFreelancer[];
  companies: PautaOptionCompany[];
  projects: PautaOptionProject[];
  members: PautaOptionMember[];
  contacts: PautaOptionContact[];
}

export interface PautaMemberDetail {
  profile_id: string;
  production_function: ProductionFunction;
  profile: PautaOptionMember | null;
}

export interface PautaCommentDetail {
  id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  author_id: string | null;
  author: PautaOptionMember | null;
}

export interface PautaHistoryEntry {
  id: string;
  from_status: string | null;
  to_status: string | null;
  from_assignee: string | null;
  to_assignee: string | null;
  note: string | null;
  created_at: string;
  changed_by_name: string | null;
  to_assignee_name: string | null;
}

export interface PautaDetail {
  pauta: PautaWithDetails;
  members: PautaMemberDetail[];
  comments: PautaCommentDetail[];
  history: PautaHistoryEntry[];
}

/** Card do quadro, agrupado por coluna. */
export type PautaBoard = Record<PautaColumn, PautaWithDetails[]>;
