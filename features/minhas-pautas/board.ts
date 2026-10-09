import { SQUADS, SQUAD_LABELS } from "@/lib/auth/squads";
import { addDays, dateInAppZone, minutesInAppZone } from "@/lib/calendar";
import { PRIORITIES, PRIORITY_LABELS } from "@/lib/domain";
import { PAUTA_COLUMNS, PAUTA_COLUMN_LABELS } from "@/lib/pautas";
import { PAUTA_COLUMN_TONE, SQUAD_TONE, type StatusTone } from "@/lib/status";
import type { PautaWithDetails, ProjectPriority, Squad } from "@/types";

/** Puro, sem dependência de servidor — usado pelas três visões do quadro pessoal. */

export const MY_PAUTAS_VIEWS = ["lista", "quadro", "calendario"] as const;
export type MyPautasView = (typeof MY_PAUTAS_VIEWS)[number];

export const KANBAN_DIMENSIONS = ["squad", "prioridade", "status"] as const;
export type KanbanDimension = (typeof KANBAN_DIMENSIONS)[number];

export const KANBAN_DIMENSION_LABELS: Record<KanbanDimension, string> = {
  squad: "Squad",
  prioridade: "Prioridade",
  status: "Status",
};

/** "semana" era o nome antigo da visão de calendário — links antigos continuam funcionando. */
export function parseView(value: string | null): MyPautasView {
  if (value === "semana") return "calendario";
  return MY_PAUTAS_VIEWS.find((view) => view === value) ?? "lista";
}

/** Padrão: por squad para quem está em mais de um squad; por prioridade para quem está em um só. */
export function parseDimension(value: string | null, squadCount: number): KanbanDimension {
  return KANBAN_DIMENSIONS.find((dimension) => dimension === value) ?? (squadCount > 1 ? "squad" : "prioridade");
}

export interface KanbanLaneDef {
  key: string;
  label: string;
  tone: StatusTone;
}

/** Urgente primeiro: a ordem das colunas e do calendário. */
const PRIORITY_ORDER: readonly ProjectPriority[] = [...PRIORITIES].reverse();

const PRIORITY_TONE: Record<ProjectPriority, StatusTone> = {
  urgente: "danger",
  alta: "alert",
  media: "neutral",
  baixa: "neutral",
};

export function laneKeyOf(pauta: PautaWithDetails, dimension: KanbanDimension): string {
  switch (dimension) {
    case "squad":
      return pauta.squad ?? "audiovisual";
    case "prioridade":
      return pauta.priority ?? "media";
    case "status":
      return pauta.board_column ?? "sprint_backlog";
  }
}

/** Colunas fixas de cada dimensão. Por squad: os squads da pessoa e qualquer outro presente nas pautas. */
export function lanesFor(dimension: KanbanDimension, pautas: PautaWithDetails[], mySquads: readonly Squad[]): KanbanLaneDef[] {
  switch (dimension) {
    case "squad": {
      const present = new Set<Squad>(mySquads);
      for (const pauta of pautas) if (pauta.squad) present.add(pauta.squad);
      return SQUADS.filter((squad) => present.has(squad)).map((squad) => ({ key: squad, label: SQUAD_LABELS[squad], tone: SQUAD_TONE[squad] }));
    }
    case "prioridade":
      return PRIORITY_ORDER.map((priority) => ({ key: priority, label: PRIORITY_LABELS[priority], tone: PRIORITY_TONE[priority] }));
    case "status":
      return PAUTA_COLUMNS.map((column) => ({ key: column, label: PAUTA_COLUMN_LABELS[column], tone: PAUTA_COLUMN_TONE[column] }));
  }
}

export function priorityRank(priority: ProjectPriority | null): number {
  const index = PRIORITY_ORDER.indexOf(priority ?? "media");
  return index === -1 ? PRIORITY_ORDER.length : index;
}

export interface CalendarDay {
  date: string;
  /** Com horário (scheduled_at): captações, reuniões — por hora. */
  timed: PautaWithDetails[];
  /** Sem horário, pelo prazo (due_date): tarefas de revisão etc. — por prioridade, abaixo das com horário. */
  untimed: PautaWithDetails[];
}

/**
 * Semana de segunda a domingo. Com horário, a pauta vai para o dia do scheduled_at (em Fortaleza);
 * sem horário, para o dia do prazo.
 */
export function groupPautasByWeek(pautas: PautaWithDetails[], monday: string): CalendarDay[] {
  const days: CalendarDay[] = Array.from({ length: 7 }, (_, index) => ({ date: addDays(monday, index), timed: [], untimed: [] }));
  const byDate = new Map(days.map((day) => [day.date, day]));

  for (const pauta of pautas) {
    if (pauta.scheduled_at) {
      byDate.get(dateInAppZone(pauta.scheduled_at))?.timed.push(pauta);
    } else if (pauta.due_date) {
      byDate.get(pauta.due_date)?.untimed.push(pauta);
    }
  }

  for (const day of days) {
    day.timed.sort((a, b) => minutesInAppZone(a.scheduled_at!) - minutesInAppZone(b.scheduled_at!));
    day.untimed.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority) || (a.title ?? "").localeCompare(b.title ?? ""));
  }
  return days;
}

export { countBySquad } from "@/features/pautas/board";

/** Filtros compartilhados pelas três visões. */
export function matchesFilters(pauta: PautaWithDetails, filters: { squad: Squad | null; search: string }): boolean {
  if (filters.squad && pauta.squad !== filters.squad) return false;
  const term = filters.search.trim().toLocaleLowerCase("pt-BR");
  if (!term) return true;
  return [pauta.title, pauta.company_name, pauta.project_name, pauta.code].some((value) => value?.toLocaleLowerCase("pt-BR").includes(term));
}
