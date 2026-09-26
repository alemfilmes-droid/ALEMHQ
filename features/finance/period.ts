import { APP_TIME_ZONE } from "@/lib/format";

export const PERIOD_KEYS = ["mes", "proximo-mes", "3-meses", "proximos-3-meses", "proximos-6-meses", "ano", "personalizado"] as const;
export type PeriodKey = (typeof PERIOD_KEYS)[number];

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  mes: "Este mês",
  "proximo-mes": "Próximo mês",
  "3-meses": "Últimos 3 meses",
  "proximos-3-meses": "Próximos 3 meses",
  "proximos-6-meses": "Próximos 6 meses",
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

function isRealDate(value: string): boolean {
  const [year = 0, month = 0, day = 0] = value.split("-").map(Number);
  return year >= 2000 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

/** Último dia do mês de uma data (yyyy-mm-dd). */
export function endOfMonthISO(date: string): string {
  const [year = 0, month = 1] = date.split("-").map(Number);
  return iso(year, month, daysInMonth(year, month));
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
    case "proximos-3-meses":
    case "proximos-6-meses": {
      // Projeção: do início do mês atual até o fim do mês N−1 à frente (inclui meses futuros).
      const months = key === "proximos-3-meses" ? 3 : 6;
      const end = shiftMonth(year, month, months - 1);
      return { key, from: iso(year, month, 1), to: iso(end.year, end.month, daysInMonth(end.year, end.month)) };
    }
    case "ano":
      return { key: "ano", from: iso(year, 1, 1), to: iso(year, 12, 31) };
    case "personalizado":
      // Qualquer intervalo válido, passado ou FUTURO (projeção de caixa) — sem limite em "hoje".
      if (from && to && ISO_DATE.test(from) && ISO_DATE.test(to) && from <= to && isRealDate(from) && isRealDate(to)) {
        return { key: "personalizado", from, to };
      }
      return { key: "mes", ...monthRange(year, month) };
    default:
      return { key: "mes", ...monthRange(year, month) };
  }
}
