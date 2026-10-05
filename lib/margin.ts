import type { MarginStatus } from "@/types";

/** Limiares da margem (em %). Vêm de company_settings; estes são os valores padrão da migração. */
export interface MarginThresholds {
  healthy: number;
  attention: number;
}

/** Política da Além: saudável ≥ 40%; atenção 30–39,99% (relatório mensal); crítico < 30% (alerta imediato). */
export const DEFAULT_MARGIN_THRESHOLDS: MarginThresholds = { healthy: 40, attention: 30 };

/** Espelha margin_status_for() no banco. */
export function marginStatusFor(percent: number, thresholds: MarginThresholds = DEFAULT_MARGIN_THRESHOLDS): MarginStatus {
  if (percent >= thresholds.healthy) return "saudavel";
  if (percent >= thresholds.attention) return "atencao";
  return "critico";
}

export function formatPercent(value: number): string {
  return `${String(Math.round(value * 10) / 10).replace(".", ",")}%`;
}
