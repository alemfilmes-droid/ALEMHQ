import type { PayableCategory } from "@/types";

/**
 * Paleta exclusiva dos gráficos do financeiro. Cor aqui é sinal (série, categoria,
 * sinal do valor) — nunca decoração. O vermelho da marca (#E5231B) nunca aparece:
 * "saídas"/despesa usa --status-danger, que já é uma cor diferente.
 */
export const CHART_GRID = "#2A2A2A";
export const CHART_INCOME = "var(--status-success)";
export const CHART_EXPENSE = "var(--status-danger)";
export const CHART_NEUTRAL = "var(--muted-foreground)";

/** Uma cor distinguível por categoria de custo. Nenhuma repete o vermelho da marca. */
export const CHART_CATEGORY_COLORS: Record<PayableCategory, string> = {
  freelancer: "#5B8DEF",
  equipamento: "#4FA394",
  locacao: "#9B7FE0",
  deslocamento: "#C9B25E",
  hospedagem: "#4FB0C7",
  alimentacao: "#9BB35B",
  trilha_licenca: "#D17FB8",
  software: "#7B8FD9",
  imposto: "#8A6BB0",
  marketing: "#C97A96",
  pessoal: "#6FA8DC",
  comissao: "#5FB37F",
  pro_labore: "#A3C4E8",
  estrutura: "#B08D6A",
  outro: "#8A8A8A",
};

/** Cores dos grupos da aba "Custos da empresa" (mesma família da paleta acima, sem o vermelho da marca). */
export const CHART_COST_GROUP_COLORS = {
  equipe: "#6FA8DC",
  software: "#7B8FD9",
  estrutura: "#B08D6A",
  impostos: "#8A6BB0",
  marketing: "#C97A96",
  outros: "#8A8A8A",
} as const;

export const CHART_TOOLTIP_STYLE = {
  background: "var(--surface-raised)",
  border: "1px solid var(--border-strong)",
  borderRadius: 8,
  color: "var(--foreground)",
  fontSize: 13,
  padding: "8px 12px",
} as const;

export const CHART_AXIS_TICK = { fill: "var(--muted-foreground)", fontSize: 12 } as const;
