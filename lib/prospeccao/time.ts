import { addDays, isWeekend, minutesInAppZone, todayInAppZone } from "@/lib/calendar";

/**
 * Datas da prospecção, sempre em America/Fortaleza (a Vercel roda em UTC). Dias são "yyyy-mm-dd";
 * feriados vêm da tabela prospect_holidays. Puro: roda no server, no client e nos testes.
 */

export interface FortalezaNow {
  /** yyyy-mm-dd */
  date: string;
  year: number;
  /** 1–12 */
  month: number;
  hour: number;
  minute: number;
}

export function nowInFortaleza(now: Date = new Date()): FortalezaNow {
  const date = todayInAppZone(now);
  const minutes = minutesInAppZone(now.toISOString());
  return {
    date,
    year: Number(date.slice(0, 4)),
    month: Number(date.slice(5, 7)),
    hour: Math.floor(minutes / 60),
    minute: minutes % 60,
  };
}

/** Uma linha de prospect_holidays: recorrente vale todo ano no mesmo dia/mês. */
export interface HolidayRule {
  date: string;
  recurring: boolean;
  /** Ponto facultativo com "Pular na prospecção" desligado: o dia conta como útil. Padrão: pula. */
  skip?: boolean;
}

export interface HolidayCalendar {
  exact: ReadonlySet<string>;
  /** "mm-dd" dos recorrentes. */
  yearly: ReadonlySet<string>;
}

export function holidayCalendar(rules: readonly HolidayRule[]): HolidayCalendar {
  const exact = new Set<string>();
  const yearly = new Set<string>();
  for (const rule of rules) {
    if (rule.skip === false) continue;
    if (rule.recurring) yearly.add(rule.date.slice(5, 10));
    else exact.add(rule.date);
  }
  return { exact, yearly };
}

export function isHoliday(day: string, calendar: HolidayCalendar): boolean {
  return calendar.exact.has(day) || calendar.yearly.has(day.slice(5, 10));
}

export function isBusinessDay(day: string, calendar: HolidayCalendar): boolean {
  return !isWeekend(day) && !isHoliday(day, calendar);
}

/** O próprio dia se for útil; senão, o próximo dia útil. */
export function nextBusinessDay(day: string, calendar: HolidayCalendar): string {
  let current = day;
  while (!isBusinessDay(current, calendar)) current = addDays(current, 1);
  return current;
}

/**
 * `n` dias úteis contados depois de `day` (que pode não ser útil: um toque enviado no domingo + 2
 * cai na terça e na quarta → quarta). Com n = 0, devolve o próprio dia, ou o próximo útil se cair
 * em fim de semana/feriado — é o Toque 1 "dia 0".
 */
export function addBusinessDays(day: string, n: number, calendar: HolidayCalendar): string {
  if (!Number.isInteger(n) || n < 0) throw new RangeError("n deve ser um inteiro ≥ 0.");
  if (n === 0) return nextBusinessDay(day, calendar);
  let current = day;
  for (let left = n; left > 0; left -= 1) current = nextBusinessDay(addDays(current, 1), calendar);
  return current;
}
