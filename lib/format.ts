export const APP_TIME_ZONE = "America/Fortaleza";
const LOCALE = "pt-BR";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Colunas `date` (yyyy-mm-dd) não têm fuso: fixa ao meio-dia UTC para não recuar um dia em Fortaleza. */
function toDate(value: string | Date) {
  return typeof value === "string" && DATE_ONLY.test(value) ? new Date(`${value}T12:00:00Z`) : new Date(value);
}

export function formatDate(value: string | Date) {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: APP_TIME_ZONE, dateStyle: "medium" }).format(toDate(value));
}

export function formatDateTime(value: string | Date) {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: APP_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(toDate(value));
}

export function formatLongDate(value: Date = new Date()) {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: APP_TIME_ZONE, dateStyle: "full" }).format(value);
}

/** Data de hoje (yyyy-mm-dd) em America/Fortaleza. */
export function todayDateOnly(now: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(now);
}

export function getGreeting(now: Date = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat(LOCALE, { timeZone: APP_TIME_ZONE, hour: "numeric", hourCycle: "h23" }).format(now),
  );
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function getFirstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? "";
}

export function getInitials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat(LOCALE, { style: "currency", currency: "BRL" }).format(value);
}

/** "2026-03-01" → "mar/26" (rótulos de eixo de gráfico). */
export function formatMonthShort(value: string) {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: APP_TIME_ZONE, month: "short", year: "2-digit" }).format(toDate(value)).replace(".", "");
}

/** "2026-03-05" → "5 mar" (eixo de dias do fluxo de caixa). */
export function formatDayShort(value: string) {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: APP_TIME_ZONE, day: "numeric", month: "short" }).format(toDate(value)).replace(".", "");
}

/** "2026-03-05" → "05/03/2026" (rótulo compacto de intervalo de datas). */
export function formatDateShort(value: string) {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: APP_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" }).format(toDate(value));
}
