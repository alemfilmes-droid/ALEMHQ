import { PAYABLE_CATEGORY_LABELS } from "@/features/finance/labels";
import type { PayableCategory } from "@/types";

/**
 * "Equipe e colaboradores" (categoria `pessoal`): regra única da categoria de um pagamento. Espelha
 * public.payable_team_rule no banco (mesmos casos em team-category-cases.json, conferidos lá), que aplica a
 * regra de verdade ao criar e ao editar — inclusive lançamentos já baixados.
 *
 * - Pró-labore marcado (ou a categoria antiga "Pró-labore") → Equipe e colaboradores · Pró-labore.
 * - Reembolso de despesa → "Outro" (não é pagamento à equipe, mesmo para alguém do HQ).
 * - Favorecido é alguém do HQ → Equipe e colaboradores · Comissão (comissão ligada / categoria antiga
 *   "Comissão") ou Pagamento a colaborador; a pessoa escolhe entre os dois.
 * - Fora disso a categoria é livre; Equipe e colaboradores escolhida à mão vale como Pagamento a colaborador.
 */

export const TEAM_PAYMENT_TYPES = ["pro_labore", "comissao", "pagamento_colaborador"] as const;
export type TeamPaymentType = (typeof TEAM_PAYMENT_TYPES)[number];

export const TEAM_PAYMENT_TYPE_LABELS: Record<TeamPaymentType, string> = {
  pro_labore: "Pró-labore",
  comissao: "Comissão",
  pagamento_colaborador: "Pagamento a colaborador",
};

export const TEAM_CATEGORY: PayableCategory = "pessoal";
export const AUTO_CATEGORY_REASON = "Categorização automática: equipe e colaboradores";

/** Por que a categoria está travada (null = livre). */
export type CategoryLock = "pro_labore" | "reembolso" | "equipe" | null;

export interface TeamRuleInput {
  category: PayableCategory;
  payeeIsMember: boolean;
  isProLabore: boolean;
  isReimbursement: boolean;
  teamType: TeamPaymentType | null;
  hasCommissionGoal: boolean;
}

export interface TeamRuleResult {
  category: PayableCategory;
  teamType: TeamPaymentType | null;
  lock: CategoryLock;
}

export function teamCategoryRule(input: TeamRuleInput): TeamRuleResult {
  if (input.isProLabore || input.category === "pro_labore") {
    return { category: TEAM_CATEGORY, teamType: "pro_labore", lock: "pro_labore" };
  }
  if (input.isReimbursement) return { category: "outro", teamType: null, lock: "reembolso" };
  const commission = input.teamType === "comissao" || input.category === "comissao" || input.hasCommissionGoal;
  if (input.payeeIsMember) {
    return { category: TEAM_CATEGORY, teamType: commission ? "comissao" : "pagamento_colaborador", lock: "equipe" };
  }
  if (input.category === TEAM_CATEGORY || input.category === "comissao") {
    return { category: TEAM_CATEGORY, teamType: commission ? "comissao" : "pagamento_colaborador", lock: null };
  }
  return { category: input.category, teamType: null, lock: null };
}

export const CATEGORY_LOCK_NOTES: Record<Exclude<CategoryLock, null>, string> = {
  pro_labore: "Definida automaticamente: pró-labore",
  reembolso: "Definida automaticamente: reembolso de despesa",
  equipe: "Definida automaticamente: favorecido é da equipe",
};

/** Tipo do pagamento à equipe, inclusive nos lançamentos antigos (categorias "Comissão" e "Pró-labore"). */
export function teamTypeOf(category: PayableCategory, teamType: TeamPaymentType | null): TeamPaymentType | null {
  if (teamType) return teamType;
  if (category === "pro_labore") return "pro_labore";
  if (category === "comissao") return "comissao";
  return category === TEAM_CATEGORY ? "pagamento_colaborador" : null;
}

/** Equipe e colaboradores por tipo (só os tipos com valor), na ordem Pró-labore, Comissão, Pagamento a colaborador. */
export function teamBreakdown(lines: readonly { category: PayableCategory; teamType: TeamPaymentType | null; amount: number }[]): { type: TeamPaymentType; total: number }[] {
  const totals = new Map<TeamPaymentType, number>();
  for (const line of lines) {
    const type = teamTypeOf(line.category, line.teamType);
    if (type) totals.set(type, (totals.get(type) ?? 0) + line.amount);
  }
  return TEAM_PAYMENT_TYPES.filter((type) => totals.has(type)).map((type) => ({ type, total: totals.get(type) ?? 0 }));
}

/** Rótulo da categoria com o tipo: "Equipe e colaboradores · Pró-labore". */
export function categoryLabel(category: PayableCategory, teamType: TeamPaymentType | null): string {
  const type = teamTypeOf(category, teamType);
  return type ? `${PAYABLE_CATEGORY_LABELS[TEAM_CATEGORY]} · ${TEAM_PAYMENT_TYPE_LABELS[type]}` : PAYABLE_CATEGORY_LABELS[category];
}
