import type { AgendaEvent, AgendaView } from "@/features/agenda/types";
import { addDays, dateInAppZone, minutesInAppZone, startOfMonth, startOfWeek, timeInAppZone } from "@/lib/calendar";

/** Puro, sem dependência de servidor — intervalo de datas de cada visão e posicionamento dos blocos. */

/** "14:00–15:30" ou "Dia inteiro", em Fortaleza. */
export function eventTimeLabel(event: Pick<AgendaEvent, "allDay" | "startsAt" | "endsAt">): string {
  return event.allDay ? "Dia inteiro" : `${timeInAppZone(event.startsAt)}–${timeInAppZone(event.endsAt)}`;
}

/** Intervalo [from, toExclusive) em datas (yyyy-mm-dd) que cada visão mostra a partir da data-âncora. */
export function viewRange(view: AgendaView, anchor: string): { from: string; toExclusive: string } {
  switch (view) {
    case "mes": {
      const from = startOfWeek(startOfMonth(anchor));
      return { from, toExclusive: addDays(from, 42) };
    }
    case "semana": {
      const from = startOfWeek(anchor);
      return { from, toExclusive: addDays(from, 7) };
    }
    case "dia":
      return { from: anchor, toExclusive: addDays(anchor, 1) };
    case "agenda":
      return { from: anchor, toExclusive: addDays(anchor, 30) };
  }
}

/** Próxima/anterior data-âncora ao navegar. */
export function shiftAnchor(view: AgendaView, anchor: string, direction: 1 | -1): string {
  switch (view) {
    case "mes": {
      const date = new Date(`${startOfMonth(anchor)}T12:00:00Z`);
      date.setUTCMonth(date.getUTCMonth() + direction);
      return date.toISOString().slice(0, 10);
    }
    case "semana":
      return addDays(anchor, 7 * direction);
    case "dia":
      return addDays(anchor, direction);
    case "agenda":
      return addDays(anchor, 30 * direction);
  }
}

/**
 * Dias (yyyy-mm-dd) em que o evento aparece. Com horário: o dia de início. Dia inteiro: todos os
 * dias cobertos (o banco grava o fim como 23:59:59 do último dia).
 */
export function eventDays(event: AgendaEvent): string[] {
  const first = dateInAppZone(event.startsAt);
  if (!event.allDay) return [first];
  const last = dateInAppZone(event.endsAt);
  const days: string[] = [];
  for (let day = first; day <= last && days.length < 62; day = addDays(day, 1)) days.push(day);
  return days;
}

export function eventsByDay(events: AgendaEvent[]): Map<string, AgendaEvent[]> {
  const map = new Map<string, AgendaEvent[]>();
  for (const event of events) {
    for (const day of eventDays(event)) {
      const list = map.get(day) ?? [];
      list.push(event);
      map.set(day, list);
    }
  }
  for (const list of map.values()) {
    list.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.startsAt.localeCompare(b.startsAt));
  }
  return map;
}

export interface PositionedEvent {
  event: AgendaEvent;
  /** Minutos desde 00:00 (Fortaleza), cortados ao próprio dia. */
  start: number;
  end: number;
  column: number;
  columns: number;
}

const MIN_BLOCK_MINUTES = 20;

/**
 * Blocos com horário de um dia, lado a lado quando se sobrepõem: agrupa em "clusters" de eventos
 * encadeados e distribui cada cluster em colunas (primeira coluna livre).
 */
export function layoutDay(events: AgendaEvent[], day: string): PositionedEvent[] {
  const timed = events
    .filter((event) => !event.allDay && dateInAppZone(event.startsAt) === day)
    .map((event) => {
      const start = minutesInAppZone(event.startsAt);
      const sameDayEnd = dateInAppZone(event.endsAt) === day ? minutesInAppZone(event.endsAt) : 24 * 60;
      return { event, start, end: Math.min(24 * 60, Math.max(sameDayEnd, start + MIN_BLOCK_MINUTES)) };
    })
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const result: PositionedEvent[] = [];
  let cluster: { event: AgendaEvent; start: number; end: number; column: number }[] = [];
  let clusterEnd = -1;

  function flush() {
    const columns = cluster.reduce((max, item) => Math.max(max, item.column + 1), 0);
    for (const item of cluster) result.push({ ...item, columns });
    cluster = [];
  }

  for (const item of timed) {
    if (item.start >= clusterEnd) {
      flush();
      clusterEnd = -1;
    }
    const taken = new Set(cluster.filter((other) => other.end > item.start).map((other) => other.column));
    let column = 0;
    while (taken.has(column)) column += 1;
    cluster.push({ ...item, column });
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  flush();
  return result;
}
