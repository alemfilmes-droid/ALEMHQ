import { formatCents } from "@/features/finance/money";

/**
 * Comemoração de comissão (Bloco 7): "Parabéns, [primeiro nome]!" / "Você ganhou R$ X de comissão" (+ a meta).
 * Uma vez por comissão — o banco guarda o "visto" (commission_celebrations.seen_at).
 */
export interface CelebrationText {
  title: string;
  amount: string;
  goal: string | null;
}

export function celebrationText(fullName: string, amountCents: number, goalTitle: string | null): CelebrationText {
  const first = fullName.trim().split(/\s+/)[0] || "pessoa";
  return {
    title: `Parabéns, ${first}!`,
    amount: `Você ganhou ${formatCents(amountCents)} de comissão`,
    goal: goalTitle?.trim() ? `Meta: ${goalTitle.trim()}` : null,
  };
}

/** Confete só sem "reduzir movimento" no aparelho. */
export function shouldAnimateConfetti(prefersReducedMotion: boolean): boolean {
  return !prefersReducedMotion;
}

export interface ConfettiPiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  spin: number;
}

/** Cores do confete: neutras e de status do HQ — nunca o vermelho da marca. */
export const CONFETTI_COLORS = ["#F0F0F0", "#22C55E", "#3B82F6", "#EAB308", "#A855F7", "#22D3EE"] as const;

/** Peças iniciais, saindo do topo (random injetável para teste). */
export function confettiPieces(count: number, width: number, random: () => number = Math.random): ConfettiPiece[] {
  return Array.from({ length: count }, () => ({
    x: random() * width,
    y: -20 - random() * 200,
    vx: (random() - 0.5) * 2,
    vy: 2 + random() * 3,
    size: 6 + random() * 6,
    color: CONFETTI_COLORS[Math.floor(random() * CONFETTI_COLORS.length)] ?? CONFETTI_COLORS[0],
    spin: random() * Math.PI,
  }));
}
