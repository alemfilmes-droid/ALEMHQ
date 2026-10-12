import type { CadenceState } from "@/lib/prospeccao/cadence";
import { normalizeWhatsapp } from "@/lib/prospeccao/phone";
import { placeholdersIn, renderScript, unknownPlaceholders, type ScriptVariable } from "@/lib/prospeccao/render";
import type { ProspectAudience, ProspectScriptKind, ProspectTouchZeroVariant } from "@/types";

/**
 * Mensagem do próximo toque (spec seções 4 e 9.1): escolhe o script pelo estado da cadência,
 * preenche as variáveis, escolhe o destinatário e monta o link wa.me. Puro.
 */

export interface ScriptRow {
  id: string;
  kind: ProspectScriptKind;
  playbookId: string | null;
  touchNumber: number | null;
  touchZeroVariant: ProspectTouchZeroVariant | null;
  audience: ProspectAudience | null;
  body: string;
}

export interface MessagePlaybook {
  id: string;
  touchZeroVariant: ProspectTouchZeroVariant;
  linkBase: string;
  linkAppendsSchoolParam: boolean;
  caseText: string | null;
}

export interface MessageLead {
  /** Nome da escola/empresa. */
  name: string;
  audience: ProspectAudience;
  contactName: string | null;
  contactPhone: string | null;
  contactIsDecisionMaker: boolean;
  decisionMakerName: string | null;
  decisionMakerWhatsapp: string | null;
  hook: string | null;
  lastDeliveredProject: string | null;
}

export interface MessageInput {
  state: CadenceState;
  scripts: readonly ScriptRow[];
  playbook: MessagePlaybook;
  lead: MessageLead;
  now: Date;
}

export interface Message {
  text: string;
  scriptId: string;
  scriptKind: ProspectScriptKind;
  /** Nulo = reativação. */
  touchNumber: number | null;
  recipient: string;
  recipientDisplay: string;
  /** O número veio sem DDD e o HQ assumiu 84. */
  assumedDdd: boolean;
}

export type MessageResult = ({ ok: true } & Message) | { ok: false; error: string };

const MISSING: Record<ScriptVariable, string> = {
  saudacao: "Falta a saudação.",
  nome: "Falta o nome do decisor.",
  escola: "Falta o nome da escola.",
  empresa: "Falta o nome da empresa.",
  gancho: "Falta o gancho do lead.",
  link: "Falta o link do playbook (URL pendente em Configurações › Prospecção).",
  case: "Falta o texto do {case} no playbook (Configurações › Prospecção).",
  mês: "Falta o mês.",
  ano_seguinte: "Falta o ano.",
  ultimo_projeto: "Falta o último projeto entregue.",
  horario_1: "Falta o primeiro horário da reunião.",
  horario_2: "Falta o segundo horário da reunião.",
};

/** O script que o estado manda usar. Toque 0 por variante do playbook; sem gancho e cliente da casa por público. */
export function pickScript(scripts: readonly ScriptRow[], state: CadenceState, playbook: MessagePlaybook, audience: ProspectAudience): ScriptRow | null {
  const applicable = state.applicableScript;
  if (!applicable) return null;
  const match = (script: ScriptRow): boolean => {
    if (script.kind !== applicable.kind) return false;
    switch (applicable.kind) {
      case "toque_zero":
        return script.playbookId === null && script.touchZeroVariant === playbook.touchZeroVariant;
      case "sem_gancho":
      case "cliente_da_casa":
        return script.playbookId === null && script.audience === audience;
      case "toque":
        return script.playbookId === playbook.id && script.touchNumber === applicable.scriptTouchNumber;
      case "reativacao":
        return script.playbookId === playbook.id;
      case "oferta_reuniao":
        return script.playbookId === null;
    }
  };
  return scripts.find(match) ?? null;
}

/** Para quem vai o toque: Toque 0 → contato geral; depois → decisor (ou o contato, se ele decide). */
export function recipientPhone(lead: Pick<MessageLead, "contactPhone" | "contactIsDecisionMaker" | "decisionMakerWhatsapp">, touchZero: boolean): { phone: string | null; missing: string } {
  if (touchZero) return { phone: lead.contactPhone, missing: "Falta o WhatsApp do contato." };
  if (lead.contactIsDecisionMaker) return { phone: lead.decisionMakerWhatsapp || lead.contactPhone, missing: "Falta o WhatsApp do contato." };
  return { phone: lead.decisionMakerWhatsapp, missing: "Falta o WhatsApp do decisor." };
}

export function buildMessage({ state, scripts, playbook, lead, now }: MessageInput): MessageResult {
  if (!state.applicableScript) return { ok: false, error: "Este lead não tem toque para enviar agora." };
  const script = pickScript(scripts, state, playbook, lead.audience);
  if (!script?.body.trim()) return { ok: false, error: "O script deste toque ainda não foi escrito (Configurações › Prospecção)." };

  const unknown = unknownPlaceholders(script.body);
  if (unknown.length) return { ok: false, error: `O script tem uma variável desconhecida: {${unknown[0]}}. Corrija em Configurações › Prospecção.` };

  const touchZero = script.kind === "toque_zero";
  const decisionMakerName = lead.contactIsDecisionMaker ? lead.decisionMakerName || lead.contactName : lead.decisionMakerName;
  const rendered = renderScript(script.body, {
    now,
    decisionMakerName,
    leadName: lead.name,
    hook: lead.hook,
    playbook,
    lastProject: lead.lastDeliveredProject,
  });
  const firstMissing = rendered.missing[0];
  if (firstMissing) return { ok: false, error: MISSING[firstMissing] };

  const { phone, missing } = recipientPhone(lead, touchZero);
  if (!phone?.trim()) return { ok: false, error: missing };
  const normalized = normalizeWhatsapp(phone);
  if (!normalized.ok) return normalized;

  return {
    ok: true,
    text: rendered.text,
    scriptId: script.id,
    scriptKind: script.kind,
    touchNumber: state.isReactivation ? null : state.currentTouch,
    recipient: normalized.number,
    recipientDisplay: normalized.display,
    assumedDdd: normalized.assumedDdd,
  };
}

/** O texto final (depois da edição) pode ir para o WhatsApp? */
export function checkFinalText(text: string): string | null {
  if (!text.trim()) return "A mensagem está vazia.";
  if (text.length > 4000) return "A mensagem passou de 4000 caracteres.";
  const left = placeholdersIn(text)[0];
  if (left !== undefined) return `Ainda há {${left}} no texto. Troque pelo valor antes de enviar.`;
  return null;
}

/** Link do WhatsApp com o texto pronto (quebras de linha viram %0A, acentos preservados). */
export function whatsappUrl(recipient: string, text: string): string {
  return `https://wa.me/${recipient}?text=${encodeURIComponent(text)}`;
}
