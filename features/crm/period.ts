import { resolvePeriod, todayISO } from "@/features/finance/period";

export const BOARD_PERIOD_KEYS = ["mes", "3-meses", "ano", "todos", "personalizado"] as const;
export type BoardPeriodKey = (typeof BOARD_PERIOD_KEYS)[number];

export const BOARD_PERIOD_LABELS: Record<BoardPeriodKey, string> = {
  mes: "Este mês",
  "3-meses": "Últimos 3 meses",
  ano: "Este ano",
  todos: "Todos",
  personalizado: "Personalizado",
};

export interface BoardPeriod {
  key: BoardPeriodKey;
  /** null = sem limite (período "Todos"). yyyy-mm-dd, inclusivo. */
  from: string | null;
  to: string | null;
}

/**
 * Período das colunas Ganho/Perdido do funil. As demais colunas mostram tudo, sempre.
 * Padrão: mês corrente.
 */
export function resolveBoardPeriod(key: string | undefined, from?: string, to?: string): BoardPeriod {
  if (key === "todos") return { key: "todos", from: null, to: null };
  const period = resolvePeriod(key === "personalizado" || key === "3-meses" || key === "ano" ? key : "mes", from, to, todayISO());
  const resolvedKey: BoardPeriodKey = period.key === "3-meses" || period.key === "ano" || period.key === "personalizado" ? period.key : "mes";
  return { key: resolvedKey, from: period.from, to: period.to };
}

/** Limites de dia em America/Fortaleza (UTC-3, sem horário de verão). */
export function dayStart(date: string) {
  return `${date}T00:00:00-03:00`;
}

export function dayEnd(date: string) {
  return `${date}T23:59:59.999-03:00`;
}
