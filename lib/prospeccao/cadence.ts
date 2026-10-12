import { addDays, todayInAppZone } from "@/lib/calendar";
import { addBusinessDays, nextBusinessDay, type HolidayCalendar } from "@/lib/prospeccao/time";
import type { ProspectScriptKind } from "@/types";

/**
 * Motor da cadência de prospecção (docs/prospeccao/spec.md, seção 3). Puro e sem estado guardado:
 * o status sai dos fatos (toques enviados, datas e escolhas do lead) na hora da leitura. Lista,
 * filtro, contador e os próximos módulos usam só esta função.
 *
 * Datas: instantes (ISO) viram dia de Fortaleza; dias são "yyyy-mm-dd".
 */

export const CADENCE_STATUSES = [
  "atrasado",
  "chamar_hoje",
  "reativar",
  "em_cadencia",
  "aguardando_decisor",
  "em_conversa",
  "reuniao_marcada",
  "sem_resposta",
  "pausado",
  "descartado",
] as const;

export type CadenceStatus = (typeof CADENCE_STATUSES)[number];

/**
 * Onde o negócio está no funil, do ponto de vista da cadência. "perdido" só volta à cadência com
 * data de reativação (ex.: orçamento recusado — spec 7.2).
 */
export type FunnelPosition = "aberto" | "reuniao" | "perdido" | "fechado";

export interface CadenceLead {
  funnel: FunnelPosition;
  /** false = contato de secretaria/recepção (começa no Toque 0). */
  contactIsDecisionMaker: boolean;
  decisionMakerSetAt: string | null;
  hook: string | null;
  /** Preenchido = cliente da casa: o Toque 1 usa o script "cliente da casa". */
  lastDeliveredProject: string | null;
  cadenceStartedAt: string;
  repliedAt: string | null;
  pausedAt: string | null;
  resumedAt: string | null;
  discardedAt: string | null;
  /** yyyy-mm-dd — objeção com data: substitui a reativação calculada. */
  manualReactivationOn: string | null;
  /** Novo decisor com cadência reiniciada: toques e resposta anteriores deixam de contar. */
  restartedAt: string | null;
  /** Cliente da casa: dia (yyyy-mm-dd) em que entra na fila (entrega + prazo). */
  houseReturnOn: string | null;
}

export interface SentTouch {
  /** 0..N; nulo = reativação. */
  touchNumber: number | null;
  sentAt: string;
}

export interface CadenceRules {
  /** Dias úteis de cada toque a partir do Toque 1 (o primeiro é sempre 0). */
  offsets: readonly number[];
  /** Dias corridos depois do último toque sem resposta. */
  reactivationDays: number;
  /** O script de reativação do playbook está vazio (usa o Toque 1 — spec 4.9). */
  reactivationScriptEmpty: boolean;
  /** O playbook usa o script "cliente da casa" no primeiro toque de quem já é cliente. */
  usesHouseClientScript: boolean;
}

export interface ApplicableScript {
  kind: ProspectScriptKind;
  /** Número do script de toque a usar (1..N); nulo para toque_zero, reativação, sem gancho e cliente da casa. */
  scriptTouchNumber: number | null;
}

export interface CadenceState {
  status: CadenceStatus;
  /** Próximo toque a enviar: 0..N, ou nulo quando é reativação ou não há o que enviar. */
  currentTouch: number | null;
  totalTouches: number;
  /** O que vai ser enviado é uma reativação. */
  isReactivation: boolean;
  nextDueDate: string | null;
  /** Script do próximo envio; nulo quando não há envio pendente agora (pausado, em conversa…). */
  applicableScript: ApplicableScript | null;
}

function dayOf(iso: string): string {
  return todayInAppZone(new Date(iso));
}

function laterDay(a: string, b: string | null): string {
  return b !== null && b > a ? b : a;
}

/**
 * Toque 1. Cliente da casa num playbook que usa o script dele → "cliente da casa"; senão o Toque 1
 * do playbook (sem gancho → versão sem gancho).
 */
function touchOneScript(lead: CadenceLead, rules: CadenceRules): ApplicableScript {
  const houseClient = Boolean(lead.houseReturnOn || lead.lastDeliveredProject?.trim());
  if (houseClient && rules.usesHouseClientScript) return { kind: "cliente_da_casa", scriptTouchNumber: null };
  if (!lead.hook?.trim()) return { kind: "sem_gancho", scriptTouchNumber: null };
  return { kind: "toque", scriptTouchNumber: 1 };
}

function scriptFor(lead: CadenceLead, rules: CadenceRules, touch: number): ApplicableScript {
  if (touch === 0) return { kind: "toque_zero", scriptTouchNumber: null };
  if (touch === 1) return touchOneScript(lead, rules);
  return { kind: "toque", scriptTouchNumber: touch };
}

function reactivationScript(lead: CadenceLead, rules: CadenceRules): ApplicableScript {
  return rules.reactivationScriptEmpty ? touchOneScript(lead, rules) : { kind: "reativacao", scriptTouchNumber: null };
}

/** Status de um envio pendente com vencimento `due`. */
function dueStatus(due: string, today: string): CadenceStatus {
  if (due < today) return "atrasado";
  if (due === today) return "chamar_hoje";
  return "em_cadencia";
}

/**
 * Estado da cadência de um lead com playbook. Nulo quando o negócio foi ganho, arquivado ou perdido
 * sem data de reativação (fora da cadência). `touches` em qualquer ordem.
 */
export function getCadenceState(
  lead: CadenceLead,
  touches: readonly SentTouch[],
  rules: CadenceRules,
  calendar: HolidayCalendar,
  today: string,
): CadenceState | null {
  const totalTouches = rules.offsets.length;
  const base = { totalTouches, currentTouch: null, isReactivation: false, nextDueDate: null, applicableScript: null };
  if (lead.funnel === "fechado" || (lead.funnel === "perdido" && !lead.manualReactivationOn)) return null;
  if (lead.discardedAt) return { ...base, status: "descartado" };
  if (lead.pausedAt) return { ...base, status: "pausado" };
  if (lead.funnel === "reuniao") return { ...base, status: "reuniao_marcada" };

  const restart = lead.restartedAt;
  const sorted = [...touches].filter((touch) => !restart || touch.sentAt >= restart).sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  const last = sorted.at(-1) ?? null;
  const resumedDay = lead.resumedAt ? nextBusinessDay(dayOf(lead.resumedAt), calendar) : null;
  const reactivation = (due: string, waiting: CadenceStatus): CadenceState => {
    const nextDueDate = laterDay(nextBusinessDay(due, calendar), resumedDay);
    return {
      ...base,
      status: nextDueDate <= today ? "reativar" : waiting,
      isReactivation: true,
      nextDueDate,
      applicableScript: reactivationScript(lead, rules),
    };
  };

  // Objeção com data: vale enquanto nenhum toque tiver sido enviado nesse dia ou depois.
  const manual = lead.manualReactivationOn;
  if (manual && !sorted.some((touch) => dayOf(touch.sentAt) >= manual)) return reactivation(manual, "em_cadencia");

  // Respondeu depois do último toque: a cadência para.
  if (lead.repliedAt && (!restart || lead.repliedAt >= restart) && (!last || lead.repliedAt >= last.sentAt)) {
    return { ...base, status: "em_conversa" };
  }

  const numbered = sorted.filter((touch) => touch.touchNumber !== null);
  const sentReactivation = sorted.some((touch) => touch.touchNumber === null);
  const highest = numbered.reduce((max, touch) => Math.max(max, touch.touchNumber ?? 0), -1);

  // Fim da cadência (ou já em ciclo de reativação): Sem resposta até o prazo, depois Reativar.
  if (last && (sentReactivation || highest >= totalTouches)) {
    return reactivation(addDays(dayOf(last.sentAt), rules.reactivationDays), "sem_resposta");
  }

  const needsTouchZero = !restart && !lead.houseReturnOn && !lead.contactIsDecisionMaker && !lead.decisionMakerSetAt;
  const pending = (touch: number, due: string): CadenceState => {
    const nextDueDate = laterDay(due, resumedDay);
    return { ...base, status: dueStatus(nextDueDate, today), currentTouch: touch, nextDueDate, applicableScript: scriptFor(lead, rules, touch) };
  };

  if (needsTouchZero) {
    if (highest < 0) return pending(0, nextBusinessDay(dayOf(lead.cadenceStartedAt), calendar));
    return { ...base, status: "aguardando_decisor" };
  }

  const next = Math.max(highest + 1, 1);
  if (next === 1) {
    const anchor = restart ?? (!lead.contactIsDecisionMaker && lead.decisionMakerSetAt ? lead.decisionMakerSetAt : lead.cadenceStartedAt);
    // Cliente da casa só entra na fila no dia da volta (entrega + prazo).
    return pending(1, nextBusinessDay(laterDay(dayOf(anchor), lead.houseReturnOn), calendar));
  }

  // Regra 7: conta a partir do envio real do toque anterior, não da data prevista.
  const previous = numbered.findLast((touch) => touch.touchNumber === next - 1) ?? numbered.at(-1);
  const gap = (rules.offsets[next - 1] ?? 0) - (rules.offsets[next - 2] ?? 0);
  return pending(next, addBusinessDays(dayOf(previous?.sentAt ?? lead.cadenceStartedAt), gap, calendar));
}

/** Entra na fila "Chamar hoje": vence hoje, está atrasado ou é hora de reativar. */
export function isDueNow(state: CadenceState | null): state is CadenceState {
  return state?.status === "atrasado" || state?.status === "chamar_hoje" || state?.status === "reativar";
}

/** Ordem da fila: atrasados primeiro, depois por data prevista. */
export function compareQueue(a: CadenceState, b: CadenceState): number {
  const overdue = (state: CadenceState) => (state.status === "atrasado" ? 0 : 1);
  return overdue(a) - overdue(b) || (a.nextDueDate ?? "").localeCompare(b.nextDueDate ?? "");
}
