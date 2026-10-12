import type { ProspectLeadRow } from "@/features/prospeccao/cadence-queries";
import type { MeetingWindow } from "@/features/prospeccao/schemas";
import type { CadenceState } from "@/lib/prospeccao/cadence";
import type { ProspectAudience, ProspectCadence, ProspectHoliday, ProspectObjection, ProspectPlaybook, ProspectScript } from "@/types";

export interface PlaybookView extends ProspectPlaybook {
  /** Cliente da casa: ids sugeridos a quem fechou este playbook, em ordem. */
  houseSuggestionIds: string[];
}

export interface GeneralSettings {
  meetingDurationMinutes: number;
  meetingWindows: MeetingWindow[];
  dailyTouchTarget: number;
  weeklyMeetingTarget: number;
  houseClientDelayDays: number;
}

export interface GoalOption {
  id: string;
  title: string;
  startsOn: string;
  endsOn: string;
}

export interface ProspectingConfig {
  general: GeneralSettings;
  playbooks: PlaybookView[];
  scripts: ProspectScript[];
  cadences: ProspectCadence[];
  objections: ProspectObjection[];
  holidays: ProspectHoliday[];
  /** Metas ativas que ainda não terminaram (mapeamento playbook → meta). */
  goals: GoalOption[];
}

/** Listas do cadastro/edição de lead no CRM: playbooks ativos (com a meta sugerida) e metas ativas. */
export interface ProspectFormOptions {
  playbooks: { id: string; name: string; audience: ProspectAudience; suggestedGoalId: string | null }[];
  goals: GoalOption[];
}

/** Prospecção no detalhe do negócio: os campos e, com playbook, o estado da cadência. */
export interface LeadProspect {
  fields: ProspectLeadRow;
  cadence: { playbookName: string; state: CadenceState } | null;
}

/** Um lead na fila "Chamar hoje" ou na visão Prospecção do CRM. */
export interface QueueItem {
  dealId: string;
  leadName: string;
  title: string;
  playbookName: string;
  state: CadenceState;
  /** O WhatsApp foi aberto e falta "Marcar enviado". */
  hasPending: boolean;
  /** Aviso sobre o número de quem recebe o próximo toque (DDD assumido, número inválido). */
  phoneNotice: string | null;
  /** Reunião marcada e ainda sem resultado. */
  meeting: OpenMeeting | null;
  /** Cliente da casa: playbooks possíveis (o atual primeiro) e se ainda dá para trocar (antes do 1º envio). */
  house: { options: { id: string; name: string }[]; canSwitch: boolean } | null;
  /** Lead de demonstração (só em desenvolvimento, nada gravado no banco). */
  demo?: boolean;
}

/** Objeção ativa, para o seletor do card (fonte única: Configurações > Prospecção). */
export interface ObjectionOption {
  id: string;
  shortcut: string;
  label: string;
  responseBody: string;
  hqAction: ProspectObjection["hq_action"];
}

export interface OpenMeeting {
  id: string;
  startsAt: string;
  endsAt: string;
  meetLink: string | null;
  /** O horário já passou: o card pergunta "Reunião aconteceu?". */
  awaitingOutcome: boolean;
}
