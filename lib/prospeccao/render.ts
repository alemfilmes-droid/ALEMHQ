import { formatSlot } from "@/lib/prospeccao/slots";
import { nowInFortaleza } from "@/lib/prospeccao/time";

/**
 * Monta o texto de um script da prospecção (docs/prospeccao/spec.md, seção 2). Puro: a prévia das
 * Configurações e o envio pelo WhatsApp (Módulo 3) usam a mesma função. Quebras de linha e qualquer
 * texto fora das {variáveis} ficam intactos; variável sem valor ou desconhecida continua escrita
 * como está, para aparecer na prévia.
 */

export const SCRIPT_VARIABLES = [
  "saudacao",
  "nome",
  "escola",
  "empresa",
  "gancho",
  "link",
  "case",
  "mês",
  "ano_seguinte",
  "ultimo_projeto",
  "horario_1",
  "horario_2",
] as const;

export type ScriptVariable = (typeof SCRIPT_VARIABLES)[number];

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

const PLACEHOLDER = /\{([^{}\s]+)\}/gu;

export interface PlaybookLinkInput {
  linkBase: string;
  linkAppendsSchoolParam: boolean;
}

export interface RenderContext {
  /** Instante do envio (padrão: agora). Saudação, mês e ano saem dele, em Fortaleza. */
  now?: Date;
  /** Nome do decisor; o script usa só o primeiro nome. */
  decisionMakerName?: string | null;
  /** Nome do lead: preenche {escola} e {empresa}. */
  leadName?: string | null;
  hook?: string | null;
  playbook?: (PlaybookLinkInput & { caseText: string | null }) | null;
  lastProject?: string | null;
  /** Início (ISO) dos horários oferecidos na frase de reunião. */
  slots?: readonly string[];
}

export interface RenderResult {
  text: string;
  /** Variáveis usadas no script que ficaram sem valor (o envio deve ser bloqueado). */
  missing: ScriptVariable[];
  /** {algo} que não é variável conhecida (provável erro de digitação). */
  unknown: string[];
}

export function isScriptVariable(name: string): name is ScriptVariable {
  return (SCRIPT_VARIABLES as readonly string[]).includes(name);
}

/** Nomes entre chaves no texto, sem repetição, na ordem em que aparecem. */
export function placeholdersIn(body: string): string[] {
  return [...new Set(Array.from(body.matchAll(PLACEHOLDER), (match) => match[1] ?? ""))];
}

export function unknownPlaceholders(body: string): string[] {
  return placeholdersIn(body).filter((name) => !isScriptVariable(name));
}

export function greetingFor(hour: number): string {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

/** {link}: vazio se a URL estiver pendente; nos playbooks de escola, com ?escola=<nome codificado>. */
export function playbookLink(playbook: PlaybookLinkInput, leadName: string | null | undefined): string {
  const base = playbook.linkBase.trim();
  const name = leadName?.trim() ?? "";
  if (!base || !playbook.linkAppendsSchoolParam || !name) return base;
  return `${base}${base.includes("?") ? "&" : "?"}escola=${encodeURIComponent(name)}`;
}

function firstName(fullName: string | null | undefined): string {
  return fullName?.trim().split(/\s+/u)[0] ?? "";
}

function variableValues(context: RenderContext): Record<ScriptVariable, string> {
  const now = nowInFortaleza(context.now);
  const leadName = context.leadName?.trim() ?? "";
  return {
    saudacao: greetingFor(now.hour),
    nome: firstName(context.decisionMakerName),
    escola: leadName,
    empresa: leadName,
    gancho: context.hook?.trim() ?? "",
    link: context.playbook ? playbookLink(context.playbook, leadName) : "",
    case: context.playbook?.caseText?.trim() ?? "",
    mês: MONTHS[now.month % 12] ?? "",
    ano_seguinte: String(now.year + 1),
    ultimo_projeto: context.lastProject?.trim() ?? "",
    horario_1: context.slots?.[0] ? formatSlot(context.slots[0]) : "",
    horario_2: context.slots?.[1] ? formatSlot(context.slots[1]) : "",
  };
}

export function renderScript(body: string, context: RenderContext = {}): RenderResult {
  const values = variableValues(context);
  const missing = new Set<ScriptVariable>();
  const unknown = new Set<string>();
  const text = body.replace(PLACEHOLDER, (placeholder, name: string) => {
    if (!isScriptVariable(name)) {
      unknown.add(name);
      return placeholder;
    }
    const value = values[name];
    if (!value) {
      missing.add(name);
      return placeholder;
    }
    return value;
  });
  return { text, missing: [...missing], unknown: [...unknown] };
}
