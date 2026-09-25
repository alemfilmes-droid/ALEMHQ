/**
 * Recorrência no subconjunto de RFC 5545 que o banco expande (expand_recurrence): FREQ diário,
 * semanal ou mensal, com UNTIL opcional. Puro — usado pelo formulário e pelo detalhe do evento.
 */

export const RECURRENCES = ["none", "daily", "weekly", "monthly"] as const;
export type Recurrence = (typeof RECURRENCES)[number];

export const RECURRENCE_LABELS: Record<Recurrence, string> = {
  none: "Não se repete",
  daily: "Todos os dias",
  weekly: "Toda semana",
  monthly: "Todo mês",
};

const FREQ: Record<Exclude<Recurrence, "none">, string> = { daily: "DAILY", weekly: "WEEKLY", monthly: "MONTHLY" };

/** "weekly" + "2026-12-31" → "FREQ=WEEKLY;UNTIL=20261231". */
export function toRRule(recurrence: Recurrence, until: string): string | null {
  if (recurrence === "none") return null;
  const base = `FREQ=${FREQ[recurrence]}`;
  return until ? `${base};UNTIL=${until.replaceAll("-", "")}` : base;
}

export function fromRRule(rule: string | null): { recurrence: Recurrence; until: string } {
  if (!rule) return { recurrence: "none", until: "" };
  const freq = /FREQ=([A-Z]+)/.exec(rule)?.[1];
  const untilRaw = /UNTIL=(\d{8})/.exec(rule)?.[1];
  const recurrence: Recurrence = freq === "DAILY" ? "daily" : freq === "WEEKLY" ? "weekly" : freq === "MONTHLY" ? "monthly" : "none";
  const until = untilRaw ? `${untilRaw.slice(0, 4)}-${untilRaw.slice(4, 6)}-${untilRaw.slice(6, 8)}` : "";
  return { recurrence, until };
}

export function describeRRule(rule: string | null): string | null {
  const { recurrence, until } = fromRRule(rule);
  if (recurrence === "none") return null;
  if (!until) return RECURRENCE_LABELS[recurrence];
  const [year, month, day] = until.split("-");
  return `${RECURRENCE_LABELS[recurrence]}, até ${day}/${month}/${year}`;
}
