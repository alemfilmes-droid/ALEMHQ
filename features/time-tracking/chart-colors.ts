import { STATUS_TONE_VAR } from "@/lib/status";

/** Paleta do gráfico de evolução do saldo. Cor é sinal (positivo/negativo) — nunca decoração. */
export const CHART_GRID = "#2A2A2A";
export const CHART_POSITIVE = STATUS_TONE_VAR.success;
export const CHART_NEGATIVE = STATUS_TONE_VAR.danger;

export const CHART_TOOLTIP_STYLE = {
  background: "var(--surface-raised)",
  border: "1px solid var(--border-strong)",
  borderRadius: 8,
  color: "var(--foreground)",
  fontSize: 13,
  padding: "8px 12px",
} as const;

export const CHART_AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 12 } as const;
