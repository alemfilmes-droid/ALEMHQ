import type { CSSProperties } from "react";

/**
 * Pílulas em degradê suave (mesma ideia dos cards de Pautas: cor em baixa opacidade sobre a superfície escura,
 * nunca um bloco de cor chapada). Fonte única das cores de status de Orçamentos e de modelo/etapa de Projetos.
 *
 * - `from` → `to`: o degradê do fundo (26% → 12% de opacidade) e a borda (45%).
 * - `text`: tom claro da mesma cor, com contraste WCAG AA (≥ 4,5:1) sobre o fundo — conferido em
 *   lib/theme/tint.test.ts para cada cor.
 * - `filled`: pílula preenchida (fundo claro, texto escuro), para status neutros em destaque.
 * O vermelho da marca (#E5231B) nunca entra aqui.
 */

export interface Tint {
  from: string;
  to: string;
  text: string;
  filled?: boolean;
}

export const TINT_ALPHA = { start: 0.26, end: 0.12, border: 0.45 } as const;

export function tintStyle(tint: Tint): CSSProperties {
  if (tint.filled) {
    return {
      backgroundImage: `linear-gradient(135deg, ${tint.from}, ${tint.to})`,
      borderColor: "transparent",
      color: tint.text,
    };
  }
  return {
    backgroundImage: `linear-gradient(135deg, color-mix(in srgb, ${tint.from} ${TINT_ALPHA.start * 100}%, transparent), color-mix(in srgb, ${tint.to} ${TINT_ALPHA.end * 100}%, transparent))`,
    borderColor: `color-mix(in srgb, ${tint.from} ${TINT_ALPHA.border * 100}%, var(--border))`,
    color: tint.text,
  };
}

// ---------------------------------------------------------------------------
// Contraste (WCAG 2.1)
// ---------------------------------------------------------------------------

type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? [...value].map((char) => char + char).join("") : value;
  return [0, 2, 4].map((index) => parseInt(full.slice(index, index + 2), 16)) as Rgb;
}

/** Cor com opacidade `alpha` sobre um fundo opaco. */
export function blend(color: string, alpha: number, background: string): Rgb {
  const top = hexToRgb(color);
  const base = hexToRgb(background);
  return top.map((channel, index) => Math.round(channel * alpha + base[index]! * (1 - alpha))) as Rgb;
}

function luminance([r, g, b]: Rgb): number {
  const linear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function contrastRatio(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/** Menor contraste do texto da pílula sobre as duas pontas do degradê, em cima de cada superfície escura. */
export function worstTintContrast(tint: Tint, surfaces: readonly string[]): number {
  const text = hexToRgb(tint.text);
  if (tint.filled) return Math.min(contrastRatio(text, hexToRgb(tint.from)), contrastRatio(text, hexToRgb(tint.to)));
  return Math.min(
    ...surfaces.flatMap((surface) => [
      contrastRatio(text, blend(tint.from, TINT_ALPHA.start, surface)),
      contrastRatio(text, blend(tint.to, TINT_ALPHA.end, surface)),
    ]),
  );
}

/** Superfícies escuras onde as pílulas aparecem (fundo, cards, linhas com hover). */
export const DARK_SURFACES = ["#0a0a0a", "#111111", "#141414", "#161616", "#1f1f1f"] as const;

// ---------------------------------------------------------------------------
// Paleta
// ---------------------------------------------------------------------------

export const TINTS = {
  /** Verde de status (--status-success). */
  success: { from: "#2e9e6b", to: "#34d399", text: "#86efac" },
  /** Vermelho suave das "Saídas" do Financeiro (--status-danger), nunca o vermelho da marca. */
  danger: { from: "#c4402e", to: "#c4402e", text: "#f7a596" },
  /** Neutro em destaque: preenchido, claro. */
  neutralFilled: { from: "#f0f0f0", to: "#cfcfcf", text: "#0a0a0a", filled: true },
  violetIndigo: { from: "#8b5cf6", to: "#6366f1", text: "#c4b5fd" },
  tealCyan: { from: "#14b8a6", to: "#06b6d4", text: "#5eead4" },
  blue: { from: "#3b82f6", to: "#60a5fa", text: "#93c5fd" },
  amber: { from: "#f59e0b", to: "#fbbf24", text: "#fcd34d" },
  purple: { from: "#a855f7", to: "#c084fc", text: "#d8b4fe" },
  yellow: { from: "#eab308", to: "#facc15", text: "#fde047" },
  green: { from: "#22c55e", to: "#10b981", text: "#86efac" },
  gray: { from: "#737373", to: "#a3a3a3", text: "#d4d4d4" },
  /** Rosa apagado (churn) — não é o vermelho da marca. */
  rose: { from: "#e11d74", to: "#be7b8a", text: "#fbb6ce" },
} as const satisfies Record<string, Tint>;
