import { APP_TIME_ZONE } from "@/lib/format";

/**
 * Datas de calendário em America/Fortaleza — puro, sem dependência de servidor (usado pela agenda
 * e pelo calendário das Minhas Pautas, no server e no client). Fortaleza não tem horário de verão:
 * o deslocamento é sempre -03:00.
 */
export const FORTALEZA_OFFSET = "-03:00";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function isDateOnly(value: string | null | undefined): value is string {
  return typeof value === "string" && DATE_ONLY.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`));
}

function noonUtc(day: string): Date {
  return new Date(`${day}T12:00:00Z`);
}

export function addDays(day: string, amount: number): string {
  const date = noonUtc(day);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function addMonths(day: string, amount: number): string {
  const date = noonUtc(`${day.slice(0, 7)}-01`);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return date.toISOString().slice(0, 10);
}

/** 0 = segunda … 6 = domingo. */
export function weekdayMondayFirst(day: string): number {
  return (noonUtc(day).getUTCDay() + 6) % 7;
}

export function startOfWeek(day: string): string {
  return addDays(day, -weekdayMondayFirst(day));
}

export function startOfMonth(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

export function isWeekend(day: string): boolean {
  return weekdayMondayFirst(day) >= 5;
}

/** Hoje (yyyy-mm-dd) em Fortaleza. */
export function todayInAppZone(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(now);
}

/** Data (yyyy-mm-dd) de um instante, vista em Fortaleza. */
export function dateInAppZone(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(new Date(iso));
}

/** Minutos desde a meia-noite de Fortaleza. */
export function minutesInAppZone(iso: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: APP_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(
    new Date(iso),
  );
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

/** "14:30" de um instante, em Fortaleza. */
export function timeInAppZone(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: APP_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}

/** Data + hora digitadas (horário de Fortaleza) → ISO em UTC. */
export function appZoneToIso(day: string, time: string): string {
  return new Date(`${day}T${time}:00${FORTALEZA_OFFSET}`).toISOString();
}

/** [início do dia, início do dia seguinte) em Fortaleza, como ISO. */
export function dayRangeIso(fromDay: string, toDayExclusive: string): { from: string; to: string } {
  return { from: appZoneToIso(fromDay, "00:00"), to: appZoneToIso(toDayExclusive, "00:00") };
}

export function daysBetween(fromDay: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => addDays(fromDay, index));
}

const WEEKDAY_SHORT = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "short" });
const WEEKDAY_LONG = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", weekday: "long" });
const DAY_MONTH = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", day: "numeric", month: "short" });
const MONTH_YEAR = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC", month: "long", year: "numeric" });

/** "seg" */
export function weekdayShort(day: string): string {
  return WEEKDAY_SHORT.format(noonUtc(day)).replace(".", "");
}

/** "segunda-feira" */
export function weekdayLong(day: string): string {
  return WEEKDAY_LONG.format(noonUtc(day));
}

/** "5 out" */
export function dayMonthShort(day: string): string {
  return DAY_MONTH.format(noonUtc(day)).replace(".", "");
}

/** "setembro de 2026" */
export function monthYearLabel(day: string): string {
  return MONTH_YEAR.format(noonUtc(day));
}

/** "22 – 28 set 2026" (ou "29 set – 5 out 2026"). */
export function weekRangeLabel(monday: string): string {
  const sunday = addDays(monday, 6);
  const sameMonth = monday.slice(0, 7) === sunday.slice(0, 7);
  const start = sameMonth ? String(Number(monday.slice(8, 10))) : dayMonthShort(monday);
  return `${start} – ${dayMonthShort(sunday)} ${sunday.slice(0, 4)}`;
}
