import { addDays, todayInAppZone } from "@/lib/calendar";
import type { ProspectAudience } from "@/types";

/**
 * Cliente da casa (spec 3 e 7.5): quem teve projeto entregue volta ao CRM, num negócio novo ligado
 * ao original, com o playbook sugerido e o script "cliente da casa". Puro.
 */

export interface HousePlaybook {
  id: string;
  audience: ProspectAudience;
  active: boolean;
  usesHouseClientScript: boolean;
  position: number;
}

export interface HouseSuggestion {
  closedPlaybookId: string;
  suggestedPlaybookId: string;
  position: number;
}

/**
 * Playbooks que o Paulo pode escolher, o padrão primeiro: as sugestões de Configurações para quem
 * fechou `closedPlaybookId` (as que usam o script "cliente da casa" na frente). Sem sugestão, os
 * playbooks com script "cliente da casa" do público do cliente.
 */
export function houseOptions(
  closedPlaybookId: string | null,
  suggestions: readonly HouseSuggestion[],
  playbooks: readonly HousePlaybook[],
  audience: ProspectAudience,
): string[] {
  const active = new Map(playbooks.filter((playbook) => playbook.active).map((playbook) => [playbook.id, playbook]));
  const suggested = suggestions
    .filter((item) => item.closedPlaybookId === closedPlaybookId && active.has(item.suggestedPlaybookId))
    .map((item) => ({ item, playbook: active.get(item.suggestedPlaybookId)! }))
    .sort((a, b) => Number(b.playbook.usesHouseClientScript) - Number(a.playbook.usesHouseClientScript) || a.item.position - b.item.position)
    .map(({ playbook }) => playbook.id);
  if (suggested.length) return suggested;
  return [...active.values()]
    .filter((playbook) => playbook.usesHouseClientScript && playbook.audience === audience)
    .sort((a, b) => a.position - b.position)
    .map((playbook) => playbook.id);
}

/** Dia (Fortaleza) em que o cliente da casa entra na fila: entrega + prazo em dias corridos. */
export function houseReturnOn(deliveredAt: string, delayDays: number): string {
  return addDays(todayInAppZone(new Date(deliveredAt)), delayDays);
}

export interface HouseOrigin {
  dealId: string;
  ownerId: string;
  playbookId: string | null;
  leadType: ProspectAudience | null;
  contactId: string | null;
  decisionMakerName: string | null;
  decisionMakerRole: string | null;
  decisionMakerWhatsapp: string | null;
}

export interface HouseContact {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
}

export interface HouseLeadPlan {
  originDealId: string | null;
  ownerId: string;
  contactId: string | null;
  audience: ProspectAudience;
  decisionMakerName: string | null;
  decisionMakerRole: string | null;
  decisionMakerWhatsapp: string | null;
  closedPlaybookId: string | null;
}

/**
 * Dados do negócio novo: com negócio de origem, reaproveita decisor, contato, dono e público; sem
 * ele (cliente cadastrado à mão), o contato conhecido vira o decisor e o dono é o SDR padrão.
 */
export function planHouseLead(input: {
  origin: HouseOrigin | null;
  contact: HouseContact | null;
  companyIsSchool: boolean;
  defaultOwnerId: string;
}): HouseLeadPlan {
  const { origin, contact } = input;
  const audience = origin?.leadType ?? (input.companyIsSchool ? "escola" : "empresa");
  if (origin?.decisionMakerName) {
    return {
      originDealId: origin.dealId,
      ownerId: origin.ownerId,
      contactId: origin.contactId ?? contact?.id ?? null,
      audience,
      decisionMakerName: origin.decisionMakerName,
      decisionMakerRole: origin.decisionMakerRole,
      decisionMakerWhatsapp: origin.decisionMakerWhatsapp ?? contact?.phone ?? null,
      closedPlaybookId: origin.playbookId,
    };
  }
  return {
    originDealId: origin?.dealId ?? null,
    ownerId: origin?.ownerId ?? input.defaultOwnerId,
    contactId: origin?.contactId ?? contact?.id ?? null,
    audience,
    decisionMakerName: contact?.name ?? null,
    decisionMakerRole: contact?.role ?? null,
    decisionMakerWhatsapp: contact?.phone ?? null,
    closedPlaybookId: origin?.playbookId ?? null,
  };
}
