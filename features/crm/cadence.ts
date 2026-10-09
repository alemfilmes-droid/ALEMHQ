import type { DealInteractionDetail } from "@/features/crm/types";
import type { StatusTone } from "@/lib/status";

/**
 * Cadência de tentativas (regra da empresa): até 7 tentativas sem resposta; a partir da terceira, uma
 * a cada 2 dias. Conta a sequência atual sem resposta — uma resposta do cliente zera a contagem.
 */
export const CADENCE_MAX_ATTEMPTS = 7;
export const CADENCE_INTERVAL_DAYS = 2;
/** A partir desta tentativa vale o intervalo de 2 dias (a 3ª vence 2 dias depois da 2ª). */
export const CADENCE_INTERVAL_FROM = 3;

export interface CadenceStatus {
  /** Tentativas seguidas sem resposta. */
  streak: number;
  lastAttemptAt: string | null;
  /** Quando a próxima tentativa deve acontecer (só a partir da 3ª). */
  nextDueAt: string | null;
  overdue: boolean;
  limitReached: boolean;
}

/** `interactions` em qualquer ordem. */
export function cadenceStatus(interactions: readonly DealInteractionDetail[], now: Date = new Date()): CadenceStatus {
  const sorted = [...interactions].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  let streak = 0;
  let lastAttemptAt: string | null = null;
  for (const item of sorted) {
    if (item.kind === "resposta_cliente" || (item.kind === "tentativa_contato" && item.responded === true)) break;
    if (item.kind !== "tentativa_contato") continue;
    streak += 1;
    lastAttemptAt ??= item.occurred_at;
  }

  const limitReached = streak >= CADENCE_MAX_ATTEMPTS;
  let nextDueAt: string | null = null;
  if (lastAttemptAt && !limitReached && streak + 1 >= CADENCE_INTERVAL_FROM) {
    const due = new Date(lastAttemptAt);
    due.setDate(due.getDate() + CADENCE_INTERVAL_DAYS);
    nextDueAt = due.toISOString();
  }

  return { streak, lastAttemptAt, nextDueAt, overdue: nextDueAt !== null && now > new Date(nextDueAt), limitReached };
}

/** Cor da barra/ponto de cada interação: respondeu = sucesso, sem resposta = perigo, aguardando = neutro. */
export function interactionReplyTone(item: Pick<DealInteractionDetail, "kind" | "responded">): StatusTone {
  if (item.kind === "resposta_cliente") return "success";
  if (item.kind !== "tentativa_contato") return "neutral";
  if (item.responded === true) return "success";
  if (item.responded === false) return "danger";
  return "neutral";
}

export function interactionReplyLabel(item: Pick<DealInteractionDetail, "kind" | "responded">): string | null {
  if (item.kind === "resposta_cliente") return "Resposta do cliente";
  if (item.kind !== "tentativa_contato") return null;
  if (item.responded === true) return "Teve resposta";
  if (item.responded === false) return "Sem resposta";
  return "Aguardando";
}
