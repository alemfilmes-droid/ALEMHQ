import type { CSSProperties } from "react";
import { SQUAD_TONE, toneColor, type StatusTone } from "@/lib/status";
import type { Squad } from "@/types";

/**
 * Tema da interface — fonte única do acento da marca e das cores de painel/squad.
 *
 * Política de cor:
 * - Base escura e monocromática (#0A0A0A, #F0F0F0, escala de cinzas).
 * - O vermelho da marca (#E5231B, `--brand-accent`) é o ACENTO da interface: gradientes de baixa
 *   opacidade, bordas finas, brilho no hover, estado ativo da navegação, ícones, anel de foco e
 *   pequenos traços decorativos. NUNCA fundo de botão, cor de texto corrido ou área grande.
 *   Botão primário continua #F0F0F0 com texto #0A0A0A.
 * - O "é" do logo mantém o vermelho intacto; nada compete com ele.
 * - Cores semânticas de status (lib/status.ts) mantêm o significado e nunca são trocadas pelo acento.
 *
 * Os valores ficam em variáveis CSS (app/globals.css). Componentes usam só estas funções/classes —
 * nenhum hex no JSX.
 */

export const ACCENT = "var(--brand-accent)";

/** Acento em uma opacidade (0–100) — para bordas, traços e brilhos. */
export function accentAlpha(percent: number): string {
  return `rgb(var(--brand-accent-rgb) / ${percent / 100})`;
}

/** Classes utilitárias do sistema de superfícies (definidas em app/globals.css). */
export const SURFACE = {
  /** Card de painel/lista: gradiente #141414→#0A0A0A, borda #1F1F1F, brilho vermelho suave no hover. */
  card: "card-surface",
  /** Card estático (formulário): mesmo gradiente, sem brilho no hover. */
  cardStatic: "card-surface card-static",
  /** Contêiner pequeno e arredondado do ícone de um card, tingido pelo acento (ou pelo tom). */
  iconChip: "icon-chip",
} as const;

// ---------------------------------------------------------------------------
// Squads: hierarquia do squad principal e cores
// ---------------------------------------------------------------------------

/** Quem está em mais de um squad: o principal segue esta ordem. */
export const SQUAD_PRIORITY: readonly Squad[] = ["diretoria", "comercial", "audiovisual", "financeiro"];

export function primarySquad(squads: readonly Squad[] | null | undefined): Squad | null {
  if (!squads || squads.length === 0) return null;
  return SQUAD_PRIORITY.find((squad) => squads.includes(squad)) ?? null;
}

/** Cor do squad (diretoria → vermelho/danger, comercial → alerta, audiovisual → atenção, financeiro → sucesso). */
export function squadColor(squad: Squad | null | undefined): string | undefined {
  return squad ? toneColor(SQUAD_TONE[squad]) : undefined;
}

/** Barra lateral/topo de um card na cor do squad de quem atribuiu ou é dono do item. */
export function squadBarStyle(squad: Squad | null | undefined): CSSProperties {
  return { background: squadColor(squad) ?? "var(--border-strong)" };
}

/** Degradê da esquerda para a direita, em baixa opacidade, na cor do squad — sobre a superfície neutra. */
export function squadGradient(squad: Squad | null | undefined, percent = 11): string | undefined {
  const color = squadColor(squad);
  return color ? `linear-gradient(90deg, color-mix(in srgb, ${color} ${percent}%, transparent) 0%, transparent 70%)` : undefined;
}

// ---------------------------------------------------------------------------
// Ícones de painel (cabeçalho de cada página). A sidebar continua monocromática.
// ---------------------------------------------------------------------------

export type PanelTone = StatusTone | "accent" | "slate";

export const PANEL_TONE: Record<string, PanelTone> = {
  "/inicio": "accent",
  "/minhas-pautas": "warning",
  "/pautas": "warning",
  "/agenda": "slate",
  "/clientes": "warning",
  "/projetos": "warning",
  "/crm": "alert",
  "/financeiro": "success",
  "/equipe": "neutral",
  "/avisos": "alert",
  "/banco-de-horas": "neutral",
  "/configuracoes": "neutral",
  "/essencia": "accent",
};

export function panelToneColor(tone: PanelTone): string | undefined {
  if (tone === "accent") return ACCENT;
  if (tone === "slate") return "var(--panel-slate)";
  return toneColor(tone);
}

/** Estilo do contêiner de ícone: fundo e borda tingidos em baixa opacidade, ícone na cor cheia. */
export function iconChipStyle(tone: PanelTone = "accent"): CSSProperties {
  const color = panelToneColor(tone);
  if (!color) return { color: "var(--muted-foreground)", borderColor: "var(--border-strong)", background: "var(--surface-raised)" };
  return {
    color,
    borderColor: `color-mix(in srgb, ${color} 30%, var(--border))`,
    background: `color-mix(in srgb, ${color} 9%, transparent)`,
  };
}

/**
 * Borda e brilho de uma coluna de quadro na cor do status (sutil: borda a 30%, brilho externo a ~8%).
 * Neutro fica com a borda padrão.
 */
export function laneGlowStyle(tone: StatusTone): CSSProperties {
  const color = toneColor(tone);
  if (!color) return {};
  return {
    borderColor: `color-mix(in srgb, ${color} 30%, var(--border))`,
    boxShadow: `0 0 0 1px color-mix(in srgb, ${color} 6%, transparent), 0 12px 36px -18px color-mix(in srgb, ${color} 45%, transparent)`,
  };
}
