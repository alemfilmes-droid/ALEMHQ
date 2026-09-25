import { APP_TIME_ZONE } from "@/lib/format";

export const PERIOD_KEYS = ["mes", "proximo-mes", "3-meses", "ano", "personalizado"] as const;
export type PeriodKey = (typeof PERIOD_KEYS)[number];

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  mes: "Este mês",
  "proximo-mes": "Próximo mês",
  "3-meses": "Últimos 3 meses",
  ano: "Ano",
  personalizado: "Personalizado",
};

export interface Period {
  key: PeriodKey;
  /** yyyy-mm-dd, inclusivo */
  from: string;
  /** yyyy-mm-dd, inclusivo */
  to: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Data de hoje (yyyy-mm-dd) em America/Fortaleza. */
export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(now);
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function iso(year: number, month: number, day: number) {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function shiftMonth(year: number, month: number, delta: number) {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function addDaysISO(date: string, days: number): string {
  const [year = 0, month = 1, day = 1] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return iso(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

/** Params de URL que reproduzem este período — para links que preservam o período atual. */
export function periodSearchParams(period: Period): Record<string, string> {
  const params: Record<string, string> = {};
  if (period.key !== "mes") params.periodo = period.key;
  if (period.key === "personalizado") {
    params.de = period.from;
    params.ate = period.to;
  }
  return params;
}

export function resolvePeriod(key: string | undefined, from?: string, to?: string, today = todayISO()): Period {
  const [year = 0, month = 1] = today.split("-").map(Number);
  const monthRange = (y: number, m: number): Pick<Period, "from" | "to"> => ({
    from: iso(y, m, 1),
    to: iso(y, m, daysInMonth(y, m)),
  });

  switch (key) {
    case "proximo-mes": {
      const next = shiftMonth(year, month, 1);
      return { key: "proximo-mes", ...monthRange(next.year, next.month) };
    }
    case "3-meses": {
      const start = shiftMonth(year, month, -2);
      return { key: "3-meses", from: iso(start.year, start.month, 1), to: today };
    }
    case "ano":
      return { key: "ano", from: iso(year, 1, 1), to: iso(year, 12, 31) };
    case "personalizado":
      if (from && to && ISO_DATE.test(from) && ISO_DATE.test(to) && from <= to) {
        return { key: "personalizado", from, to };
      }
      return { key: "mes", ...monthRange(year, month) };
    default:
      return { key: "mes", ...monthRange(year, month) };
  }
}
