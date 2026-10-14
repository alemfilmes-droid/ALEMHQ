import type { AccessRole, OrgLevel, Squad } from "@/types";

/**
 * Regra única de notificações (Bloco 5; CRM revisto em 13/10/2026). A mesma regra roda no banco
 * (public.notification_rule, aplicada a toda notificação inserida); este espelho existe para os testes e para a
 * tela explicar o que chega para quem. Os casos de teste ficam em routing-cases.json e são conferidos nos dois
 * lados.
 *
 * CRM (negócios, alertas, prospecção, pautas do CRM e compromissos de reunião comercial):
 * - CEO (master): lista branca — só "negócio qualificado (passou para ele fechar)" e "resposta do comercial a um
 *   direcionamento dele". Nada de prazo, alerta automático, follow-up nem "está com a bola". A reunião marcada
 *   para ele continua indo para o Google Agenda (agenda, não notificação).
 * - Demais: só o comercial (SDR, BDR, Atendimento, Head Comercial). Prazos e alertas, só para quem está com a bola.
 */

export interface NotificationFacts {
  /** Quem recebe é o CEO (conta master). */
  recipientIsCeo: boolean;
  /** Quem recebe é do comercial (SDR, BDR, Atendimento ou Head Comercial) — ver isCommercialRecipient. */
  recipientIsCommercial: boolean;
  type: string;
  /** Notificação de pauta: o squad. */
  pautaSquad: Squad | null;
  /** A pauta (ou o compromisso) é do CRM: pauta de um negócio, ou reunião comercial/compromisso de um negócio. */
  entityIsCrm: boolean | null;
  /** Quem recebe está com a bola (pauta do CRM: responsável atual; negócio: responsible_id). */
  holdsBall: boolean | null;
}

/** Do CRM, o CEO recebe só estes dois. */
export const CEO_CRM_TYPES = new Set(["deal_qualification_review", "deal_request_reply"]);
const BALL_DEADLINES = new Set(["pauta_due_today", "pauta_overdue", "pauta_client_followup"]);
const CRM_ALERTS = new Set(["crm_action_overdue", "crm_stale_prospection", "crm_needs_update"]);
const CEO_FINANCE = new Set(["finance_overdue_receivable", "finance_overdue_payable"]);
const COMMISSIONS = new Set(["finance_commission", "finance_commission_updated"]);
/** CEO · metas (Bloco 7): finalizar, revisar lançamento e agendar o pagamento da comissão. */
const CEO_GOALS = new Set(["goal_review", "goal_entry_pending", "goal_commission_to_schedule"]);

export function isCrmNotification(type: string, entityIsCrm: boolean | null): boolean {
  if (type.startsWith("deal_") || type.startsWith("crm_") || type.startsWith("prospect_")) return true;
  return entityIsCrm === true && (type.startsWith("pauta_") || type.startsWith("commitment_"));
}

/** Comercial: papel SDR/BDR, squad Comercial ou cargo de Atendimento/Comercial (ex.: "Head Comercial"). */
export function isCommercialRecipient(person: { accessRole: AccessRole; orgLevel: OrgLevel; squads: readonly Squad[]; jobTitle: string | null }): boolean {
  if (person.accessRole === "sdr" || person.accessRole === "bdr") return true;
  if (person.squads.includes("comercial")) return true;
  return /atendimento|comercial|\bsdr\b|\bbdr\b/i.test(person.jobTitle ?? "");
}

export function notificationAllowed(facts: NotificationFacts): boolean {
  const { recipientIsCeo, recipientIsCommercial, type, pautaSquad, entityIsCrm, holdsBall } = facts;
  if (isCrmNotification(type, entityIsCrm)) {
    if (recipientIsCeo) return CEO_CRM_TYPES.has(type);
    if (!recipientIsCommercial) return false;
    if (BALL_DEADLINES.has(type) || CRM_ALERTS.has(type)) return holdsBall === true;
    return true;
  }
  if (!recipientIsCeo) return true;
  if (CEO_GOALS.has(type)) return true;
  if (type.startsWith("goal_")) return false;
  if (COMMISSIONS.has(type)) return true;
  if (CEO_FINANCE.has(type)) return true;
  if (type.startsWith("finance_")) return false;
  if (type.startsWith("pauta_")) return !["comercial", "financeiro"].includes(pautaSquad ?? "audiovisual");
  return true;
}
