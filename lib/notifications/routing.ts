import type { Squad } from "@/types";

/**
 * Regra única de notificações (Bloco 5). A mesma regra roda no banco (public.notification_rule,
 * aplicada a toda notificação inserida); este espelho existe para os testes e para a tela explicar o
 * que chega para quem. Os casos de teste ficam em routing-cases.json e são conferidos nos dois lados.
 */

export interface NotificationFacts {
  /** Quem recebe é o CEO (conta master). */
  recipientIsCeo: boolean;
  type: string;
  /** Notificação de pauta: o squad e se é a pauta de um negócio do CRM. */
  pautaSquad: Squad | null;
  pautaIsCrm: boolean | null;
  /** Quem recebe está com a bola (pauta do CRM: responsável atual; negócio: responsible_id). */
  holdsBall: boolean | null;
}

const BALL_DEADLINES = new Set(["pauta_due_today", "pauta_overdue", "pauta_client_followup"]);
const CRM_ALERTS = new Set(["crm_action_overdue", "crm_stale_prospection", "crm_needs_update"]);
const CEO_COMMERCIAL = new Set(["deal_responsible", "deal_qualification_review", "deal_request", "deal_request_reply", "deal_request_resolved"]);
const CEO_FINANCE = new Set(["finance_overdue_receivable", "finance_due_today_payable"]);
const COMMISSIONS = new Set(["finance_commission", "finance_commission_updated"]);

export function notificationAllowed(facts: NotificationFacts): boolean {
  const { recipientIsCeo, type, pautaSquad, pautaIsCrm, holdsBall } = facts;
  if (pautaIsCrm && BALL_DEADLINES.has(type)) return holdsBall === true;
  if (CRM_ALERTS.has(type)) return holdsBall === true;
  if (!recipientIsCeo) return true;
  if (CEO_COMMERCIAL.has(type)) return true;
  if (type.startsWith("deal_") || type.startsWith("crm_") || type.startsWith("prospect_")) return false;
  if (type.startsWith("goal_") || COMMISSIONS.has(type)) return true;
  if (CEO_FINANCE.has(type)) return true;
  if (type.startsWith("finance_")) return false;
  if (type.startsWith("pauta_")) return !pautaIsCrm && !["comercial", "financeiro"].includes(pautaSquad ?? "audiovisual");
  return true;
}
