import { addDays, appZoneToIso, todayInAppZone } from "@/lib/calendar";
import { isBusinessDay, type HolidayCalendar } from "@/lib/prospeccao/time";

/**
 * Horários livres para a reunião com o Anderson (spec 7.1). Puro: as fontes de "ocupado" chegam
 * prontas (Google, agenda do HQ e, no futuro, WAWS). Tudo em America/Fortaleza.
 */

export interface TimeWindow {
  /** "09:00" */
  start: string;
  end: string;
}

export interface Interval {
  start: string;
  end: string;
}

export interface SlotRules {
  durationMinutes: number;
  windows: readonly TimeWindow[];
  calendar: HolidayCalendar;
  /** Antecedência mínima em minutos (padrão: 2 h). */
  leadMinutes?: number;
  /** Quantos dias úteis olhar à frente (padrão: 10). */
  businessDays?: number;
  /** Passo entre começos possíveis, em minutos (padrão: 30). */
  stepMinutes?: number;
}

const MINUTE = 60_000;

function minutesOf(time: string): number {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function clock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

export function overlaps(a: Interval, b: Interval): boolean {
  return Date.parse(a.start) < Date.parse(b.end) && Date.parse(b.start) < Date.parse(a.end);
}

export function isFree(slot: Interval, busy: readonly Interval[]): boolean {
  return !busy.some((item) => overlaps(slot, item));
}

/** O horário cai inteiro dentro de uma janela, num dia útil? */
export function insideWindows(slot: Interval, rules: Pick<SlotRules, "windows" | "calendar">): boolean {
  const day = todayInAppZone(new Date(slot.start));
  if (!isBusinessDay(day, rules.calendar) || todayInAppZone(new Date(Date.parse(slot.end) - 1)) !== day) return false;
  const start = Date.parse(slot.start);
  const end = Date.parse(slot.end);
  return rules.windows.some((window) => start >= Date.parse(appZoneToIso(day, window.start)) && end <= Date.parse(appZoneToIso(day, window.end)));
}

/** Todos os horários livres, em ordem. */
export function freeSlots(now: Date, busy: readonly Interval[], rules: SlotRules): Interval[] {
  const lead = (rules.leadMinutes ?? 120) * MINUTE;
  const step = rules.stepMinutes ?? 30;
  const earliest = now.getTime() + lead;
  const slots: Interval[] = [];
  let day = todayInAppZone(now);
  for (let counted = 0; counted < (rules.businessDays ?? 10); day = addDays(day, 1)) {
    if (!isBusinessDay(day, rules.calendar)) continue;
    counted += 1;
    for (const window of rules.windows) {
      const last = minutesOf(window.end) - rules.durationMinutes;
      for (let start = minutesOf(window.start); start <= last; start += step) {
        const startIso = appZoneToIso(day, clock(start));
        if (Date.parse(startIso) < earliest) continue;
        const slot = { start: startIso, end: new Date(Date.parse(startIso) + rules.durationMinutes * MINUTE).toISOString() };
        if (isFree(slot, busy)) slots.push(slot);
      }
    }
  }
  return slots;
}

/** Dois horários, de preferência em dias diferentes. Menos de dois quando a agenda está cheia. */
export function suggestSlots(now: Date, busy: readonly Interval[], rules: SlotRules): Interval[] {
  const slots = freeSlots(now, busy, rules);
  const first = slots[0];
  if (!first) return [];
  const firstDay = todayInAppZone(new Date(first.start));
  const second = slots.find((slot) => todayInAppZone(new Date(slot.start)) !== firstDay) ?? slots[1];
  return second ? [first, second] : [first];
}

const WEEKDAYS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** "terça (14/10) às 9h" / "quarta (15/10) às 14h30". */
export function formatSlot(iso: string): string {
  const day = todayInAppZone(new Date(iso));
  const weekday = WEEKDAYS[new Date(`${day}T12:00:00Z`).getUTCDay()] ?? "";
  const minutes = Math.round((Date.parse(iso) - Date.parse(appZoneToIso(day, "00:00"))) / MINUTE);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${weekday} (${day.slice(8, 10)}/${day.slice(5, 7)}) às ${hour}h${minute ? String(minute).padStart(2, "0") : ""}`;
}
