import type { GoalCommissionMode } from "@/types";

/**
 * "Finalizar meta" (Bloco 7). Espelho de goal_finalize() no banco, para a tela mostrar o resultado antes de
 * confirmar. Valores em centavos/centésimos inteiros.
 */

export interface FinalizeInput {
  mode: GoalCommissionMode;
  /** percentual: %; valor_fixo/por_unidade: centavos. */
  rate: number;
  target: number;
  achieved: number;
  reached: boolean;
  /** Percentual: o valor final (centavos) que o CEO informou, já calculado. */
  enteredCommission: number | null;
}

export type FinalizeResult = { ok: true; commission: number; missingPct: number } | { ok: false; error: string };

/** Quanto faltou para 100%, com uma casa ("faltaram 18%"). Nunca negativo. */
export function missingPct(achieved: number, target: number): number {
  if (target <= 0) return 0;
  return Math.max(0, Math.round((100 - (achieved * 100) / target) * 10) / 10);
}

export function finalizeGoal(input: FinalizeInput): FinalizeResult {
  const missing = missingPct(input.achieved, input.target);
  if (!input.reached) return { ok: true, commission: 0, missingPct: missing };
  switch (input.mode) {
    case "percentual":
      if (!input.enteredCommission || input.enteredCommission <= 0) return { ok: false, error: "Informe o valor final da comissão (R$), já calculado." };
      return { ok: true, commission: input.enteredCommission, missingPct: missing };
    case "valor_fixo":
      return { ok: true, commission: input.rate, missingPct: missing };
    case "por_unidade":
      return { ok: true, commission: Math.round((input.achieved * input.rate) / 100), missingPct: missing };
    case "contratos_fechados":
      return { ok: false, error: "Metas por contratos fechados são encerradas pela aprovação." };
  }
}
