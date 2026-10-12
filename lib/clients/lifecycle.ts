import type { StatusTone } from "@/lib/status";
import type { ClosureReason } from "@/types";

/**
 * Ciclo de vida do cliente (Bloco 6). Puro: espelha as regras do banco (client_close, client_pause,
 * client_inactive_status) para a tela mostrar exatamente o que vai acontecer antes de confirmar.
 */

export const INACTIVE_STATUSES = ["churn", "pausado", "encerrado"] as const;
export type InactiveStatus = (typeof INACTIVE_STATUSES)[number];

export const INACTIVE_STATUS_LABELS: Record<InactiveStatus, string> = { churn: "Churn", pausado: "Pausado", encerrado: "Encerrado" };
export const INACTIVE_STATUS_TONE: Record<InactiveStatus, StatusTone> = { churn: "danger", pausado: "warning", encerrado: "neutral" };

/** Espelho de client_inactive_status(): o motivo do encerramento em aberto vira a etiqueta. */
export function inactiveStatusOf(reason: ClosureReason): InactiveStatus {
  if (reason === "churn") return "churn";
  if (reason === "pausa_temporaria") return "pausado";
  return "encerrado";
}

/** Motivos de "Encerrado" (Churn é o próprio motivo; Pausa é outro fluxo). */
export const ENDED_REASONS = ["fim_de_contrato", "projeto_concluido", "outro"] as const satisfies readonly ClosureReason[];

export interface OpenEntry {
  id: string;
  amount: number | null;
}

export interface ManualEntry {
  description: string;
  amount: string;
  dueDate: string;
  /** Só em custos. */
  payeeName?: string;
}

export interface FinancePlan {
  kept: OpenEntry[];
  cancelled: OpenEntry[];
  keptTotal: number;
  cancelledTotal: number;
}

/**
 * O que acontece com os lançamentos em aberto: "Sim" → os marcados continuam e os demais são
 * cancelados; "Não" → todos os em aberto são cancelados (a tela pede confirmação explícita).
 * Pagos e recebidos nunca entram aqui (não mudam).
 */
export function financePlan(open: readonly OpenEntry[], answer: "sim" | "nao", keptIds: readonly string[]): FinancePlan {
  const kept = answer === "sim" ? open.filter((entry) => keptIds.includes(entry.id)) : [];
  const cancelled = open.filter((entry) => !kept.includes(entry));
  const total = (list: OpenEntry[]) => list.reduce((sum, entry) => sum + (entry.amount ?? 0), 0);
  return { kept, cancelled, keptTotal: total(kept), cancelledTotal: total(cancelled) };
}

/** Lançamento manual completo (o banco repete a regra). */
export function manualEntryError(entry: ManualEntry, kind: "receivable" | "payable", parseCents: (input: string) => number | null): string | null {
  if (entry.description.trim().length < 2) return "Informe a descrição.";
  const cents = parseCents(entry.amount);
  if (cents === null || cents <= 0) return "Informe um valor maior que zero.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.dueDate)) return "Informe o vencimento.";
  if (kind === "payable" && !(entry.payeeName ?? "").trim()) return "Informe o favorecido.";
  return null;
}

/** "O cliente foi finalizado?" só aparece quando o projeto finalizado era o último ativo do cliente. */
export function isLastActiveProject(finalizedProjectId: string, activeProjectIds: readonly string[]): boolean {
  return activeProjectIds.every((id) => id === finalizedProjectId);
}
