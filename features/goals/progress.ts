import { formatCents } from "@/features/finance/money";
import { GOAL_METRIC_UNITS, type GoalItem } from "@/features/goals/types";

/**
 * Contas da meta, em centésimos inteiros. A comissão espelha goal_commission() no banco: abaixo do
 * gatilho (min_achievement_pct) é zero; a partir dele, proporcional ao atingido.
 */
export function goalCommission(rate: number, minPct: number, target: number, achieved: number): number {
  if (target <= 0 || achieved <= 0 || (achieved * 100) / target < minPct) return 0;
  // A mesma conta nos dois modos: percentual (rate em %, achieved em centavos) e por_unidade (rate
  // em centavos por unidade, achieved em centésimos de unidade) dão centavos.
  return Math.round((achieved * rate) / 100);
}

/**
 * Comissão sobre contratos fechados: a taxa da meta se bater o mínimo, senão a fixa (fallback).
 * Depois da aprovação vale a taxa travada. Espelha goal_contract_rate() no banco.
 */
export function contractRate(goal: Pick<GoalItem, "commissionRate" | "fallbackRate" | "lockedRate" | "minAchievementPct" | "target">, achieved: number): number {
  if (goal.lockedRate != null) return goal.lockedRate;
  return goal.target > 0 && (achieved * 100) / goal.target >= goal.minAchievementPct ? goal.commissionRate : goal.fallbackRate;
}

export function percentOf(value: number, target: number): number {
  return target > 0 ? (value * 100) / target : 0;
}

/** Dias corridos entre duas datas yyyy-mm-dd (b − a). */
function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
}

export interface GoalPace {
  totalDays: number;
  /** Dias já corridos, contando hoje (0 antes do início). */
  elapsedDays: number;
  /** Dias que faltam, contando hoje (0 depois do fim). */
  daysLeft: number;
  /** Onde a meta deveria estar hoje, num ritmo linear. */
  expected: number;
  /** Atingido confirmado − esperado (negativo = atrás). */
  gap: number;
  /** Quanto falta por dia para bater, contando hoje. */
  perDayNeeded: number;
  /** Projeção no fim do período mantendo o ritmo atual (aprovados + pendentes). */
  projected: number;
  projectedCommission: number;
}

export function goalPace(goal: GoalItem, today: string): GoalPace {
  const totalDays = diffDays(goal.startsOn, goal.endsOn) + 1;
  const elapsedDays = Math.min(Math.max(diffDays(goal.startsOn, today) + 1, 0), totalDays);
  const daysLeft = Math.min(Math.max(diffDays(today, goal.endsOn) + 1, 0), totalDays);
  const expected = Math.round((goal.target * elapsedDays) / totalDays);
  const remaining = Math.max(goal.target - goal.approved, 0);
  const current = goal.approved + goal.pending;
  const projected = elapsedDays > 0 ? Math.round((current * totalDays) / elapsedDays) : current;
  return {
    totalDays,
    elapsedDays,
    daysLeft,
    expected,
    gap: goal.approved - expected,
    perDayNeeded: daysLeft > 0 ? Math.ceil(remaining / daysLeft) : remaining,
    projected,
    // Contratos: a projeção é a taxa que a meta alcançaria no ritmo atual sobre o que já fechou.
    projectedCommission:
      goal.commissionMode === "contratos_fechados"
        ? Math.round((goal.closedValuePotential * contractRate(goal, projected)) / 100)
        : goalCommission(goal.commissionRate, goal.minAchievementPct, goal.target, projected),
  };
}

const qty = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

/** Valor da meta para exibição: dinheiro em R$; quantidades com a unidade. */
export function formatGoalValue(goal: Pick<GoalItem, "isMoney" | "metric" | "unitLabel">, hundredths: number, withUnit = true): string {
  if (goal.isMoney) return formatCents(hundredths);
  const text = qty.format(hundredths / 100);
  const unit = goal.metric === "personalizada" ? goal.unitLabel ?? "" : GOAL_METRIC_UNITS[goal.metric];
  return withUnit && unit ? `${text} ${unit}` : text;
}

export function formatCommissionRule(goal: Pick<GoalItem, "commissionMode" | "commissionRate" | "minAchievementPct" | "fallbackRate">): string {
  if (goal.commissionMode === "contratos_fechados") {
    return `${qty.format(goal.commissionRate)}% sobre os contratos fechados das contas da meta se bater ${qty.format(goal.minAchievementPct)}%; abaixo disso, só a comissão fixa de ${qty.format(goal.fallbackRate)}%`;
  }
  const rate =
    goal.commissionMode === "percentual" ? `${qty.format(goal.commissionRate)}% sobre o atingido` : `${formatCents(goal.commissionRate)} por unidade`;
  return `${rate}, a partir de ${qty.format(goal.minAchievementPct)}% da meta`;
}
