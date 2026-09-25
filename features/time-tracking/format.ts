import { APP_TIME_ZONE, todayDateOnly } from "@/lib/format";

export { todayDateOnly };

/** minutos → "6h12" (ou "-2h30" para saldo negativo). */
export function formatMinutes(totalMinutes: number): string {
  const sign = totalMinutes < 0 ? "-" : "";
  const abs = Math.abs(Math.round(totalMinutes));
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `${sign}${hours}h${String(minutes).padStart(2, "0")}`;
}

/** minutos → "6h12min", mais explícito para KPIs isolados. */
export function formatMinutesLong(totalMinutes: number): string {
  const sign = totalMinutes < 0 ? "-" : "";
  const abs = Math.abs(Math.round(totalMinutes));
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  if (hours === 0) return `${sign}${minutes}min`;
  return `${sign}${hours}h${minutes > 0 ? `${String(minutes).padStart(2, "0")}min` : ""}`;
}

export function formatTime(isoValue: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: APP_TIME_ZONE, hour: "2-digit", minute: "2-digit" }).format(new Date(isoValue));
}

export function formatWeekday(dateOnly: string): string {
  const label = new Intl.DateTimeFormat("pt-BR", { timeZone: APP_TIME_ZONE, weekday: "short" }).format(new Date(`${dateOnly}T12:00:00Z`));
  return label.replace(".", "");
}

/** "2026-03-05" → "05/03" (extrato, sem o ano). */
export function formatDayMonth(dateOnly: string): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: APP_TIME_ZONE, day: "2-digit", month: "2-digit" }).format(new Date(`${dateOnly}T12:00:00Z`));
}

export function elapsedMinutesSince(occurredAtIso: string, now: Date = new Date()): number {
  return Math.max(0, (now.getTime() - new Date(occurredAtIso).getTime()) / 60000);
}

/** América/Fortaleza não observa horário de verão desde 2019: deslocamento fixo de -03:00. */
const FORTALEZA_OFFSET = "-03:00";

/** Início (inclusivo) e fim (exclusivo) de um dia local, em ISO UTC — para filtrar `occorred_at`. */
export function fortalezaDayBounds(dateOnly: string): { startIso: string; endIsoExclusive: string } {
  const start = new Date(`${dateOnly}T00:00:00${FORTALEZA_OFFSET}`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { startIso: start.toISOString(), endIsoExclusive: end.toISOString() };
}

/** Data local (yyyy-mm-dd) de um timestamp ISO, em America/Fortaleza. */
export function dateOnlyOf(isoValue: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(new Date(isoValue));
}

/** Combina data + hora "HH:MM" (inputs do formulário, em horário local) num ISO UTC. */
export function toIsoFromLocal(dateOnly: string, timeHHmm: string): string {
  return new Date(`${dateOnly}T${timeHHmm}:00${FORTALEZA_OFFSET}`).toISOString();
}
