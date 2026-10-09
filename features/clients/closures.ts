import type { StatusTone } from "@/lib/status";
import type { ClientHealth, ClosureReason, Json, ProspectPotential } from "@/types";

/** Puro (sem servidor): rótulos e formato do encerramento, usados no cliente, no projeto e no CRM. */

export const CLOSURE_REASONS = ["churn", "fim_de_contrato", "projeto_concluido", "pausa_temporaria", "outro"] as const satisfies readonly ClosureReason[];

export const CLOSURE_REASON_LABELS: Record<ClosureReason, string> = {
  churn: "Churn",
  fim_de_contrato: "Fim de contrato",
  projeto_concluido: "Projeto concluído",
  pausa_temporaria: "Pausa temporária",
  outro: "Outro motivo",
};

export const PROSPECT_POTENTIALS = ["alto", "medio", "baixo", "nenhum"] as const satisfies readonly ProspectPotential[];

export const PROSPECT_POTENTIAL_LABELS: Record<ProspectPotential, string> = {
  alto: "Alto",
  medio: "Médio",
  baixo: "Baixo",
  nenhum: "Nenhum",
};

export const PROSPECT_POTENTIAL_TONE: Record<ProspectPotential, StatusTone> = {
  alto: "success",
  medio: "warning",
  baixo: "alert",
  nenhum: "danger",
};

/** Espelha closure_health() no banco: churn → churn; pausa → atenção; fim planejado mantém a saúde. */
export function closureHealth(reason: ClosureReason, current: ClientHealth): ClientHealth {
  if (reason === "churn") return "churn";
  if (reason === "pausa_temporaria") return "atencao";
  return current;
}

export interface ClosureSummary {
  projects: number;
  pautas: number;
  receivablesCancelled: number;
  receivablesKept: number;
  payablesCancelled: number;
  payablesKept: number;
  invoiceSchedules: number;
}

export interface ClientClosureInfo {
  id: string;
  projectId: string | null;
  reason: ClosureReason;
  description: string;
  closedAt: string;
  potential: ProspectPotential;
  notes: string | null;
  hasPendingReceivables: boolean;
  pendingReceivablesNote: string | null;
  hasPendingPayables: boolean;
  pendingPayablesNote: string | null;
  closedByName: string | null;
  reopenedAt: string | null;
  createdAt: string;
  summary: ClosureSummary | null;
}

function num(record: Record<string, Json | undefined>, key: string): number {
  const value = record[key];
  return typeof value === "number" ? value : 0;
}

export function parseClosureSummary(value: Json): ClosureSummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return {
    projects: num(value, "projects"),
    pautas: num(value, "pautas"),
    receivablesCancelled: num(value, "receivables_cancelled"),
    receivablesKept: num(value, "receivables_kept"),
    payablesCancelled: num(value, "payables_cancelled"),
    payablesKept: num(value, "payables_kept"),
    invoiceSchedules: num(value, "invoice_schedules"),
  };
}

/** Linha de client_closures (com o nome de quem encerrou) → formato da tela. */
export function toClosureInfo(row: {
  id: string;
  project_id: string | null;
  reason: ClosureReason;
  description: string;
  closed_at: string;
  future_prospect_potential: ProspectPotential;
  notes: string | null;
  has_pending_receivables: boolean;
  pending_receivables_note: string | null;
  has_pending_payables: boolean;
  pending_payables_note: string | null;
  reopened_at: string | null;
  created_at: string;
  summary: Json;
  closer: { full_name: string } | null;
}): ClientClosureInfo {
  return {
    id: row.id,
    projectId: row.project_id,
    reason: row.reason,
    description: row.description,
    closedAt: row.closed_at,
    potential: row.future_prospect_potential,
    notes: row.notes,
    hasPendingReceivables: row.has_pending_receivables,
    pendingReceivablesNote: row.pending_receivables_note,
    hasPendingPayables: row.has_pending_payables,
    pendingPayablesNote: row.pending_payables_note,
    closedByName: row.closer?.full_name ?? null,
    reopenedAt: row.reopened_at,
    createdAt: row.created_at,
    summary: parseClosureSummary(row.summary),
  };
}

export const CLOSURE_SELECT =
  "id, project_id, reason, description, closed_at, future_prospect_potential, notes, has_pending_receivables, pending_receivables_note, has_pending_payables, pending_payables_note, reopened_at, created_at, summary, closer:profiles!client_closures_closed_by_fkey(full_name)";
