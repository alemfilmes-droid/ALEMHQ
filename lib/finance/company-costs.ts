import { COMPANY_COST_GROUPS, COMPANY_COST_GROUP_OF, type CompanyCostGroup } from "@/features/finance/labels";
import { teamBreakdown, teamTypeOf, type TeamPaymentType } from "@/lib/finance/team-category";
import type { PayableCategory } from "@/types";

/**
 * "Custos da empresa": em que cartão cada pagamento entra e os totais do mês. Regra única (testada em
 * company-costs.test.ts):
 * - Pró-labore (retirada dos sócios, pelo tipo — inclusive nos lançamentos antigos com a categoria "Pró-labore")
 *   vai SEMPRE para o cartão "Pró-labore (sócios)", nunca para "Equipe e colaboradores". Entra mesmo quando está
 *   ligado a um projeto (aí também pesa na margem daquele projeto).
 * - Os demais só entram quando são custo da empresa (cost_scope = empresa, sem projeto).
 * - Cada cartão soma só as próprias linhas; o total do mês é a soma dos cartões.
 */

export interface CompanyCostInput {
  category: PayableCategory;
  teamType: TeamPaymentType | null;
  costScope: "empresa" | "projeto";
  isFixed: boolean;
  /** Centavos. */
  amount: number;
  /** yyyy-mm-dd */
  dueDate: string;
}

export function costGroupOf(line: Pick<CompanyCostInput, "category" | "teamType">): CompanyCostGroup {
  return teamTypeOf(line.category, line.teamType) === "pro_labore" ? "pro_labore" : COMPANY_COST_GROUP_OF[line.category];
}

export function isCompanyCost(line: Pick<CompanyCostInput, "category" | "teamType" | "costScope">): boolean {
  return line.costScope === "empresa" || costGroupOf(line) === "pro_labore";
}

export interface GroupTotal {
  group: CompanyCostGroup;
  total: number;
  fixed: number;
  variable: number;
  /** Parte ligada a projetos (só o pró-labore pode ter). */
  linkedToProjects: number;
  /** Equipe e colaboradores por tipo (só no grupo Equipe; nunca tem Pró-labore). */
  teamBreakdown: { type: TeamPaymentType; total: number }[];
}

export interface MonthSummary {
  groups: GroupTotal[];
  total: number;
  fixed: number;
  variable: number;
  /** % do faturamento consumido pelos custos fixos (null sem faturamento). */
  fixedShare: number | null;
}

export function fixedShareOf(fixed: number, revenue: number): number | null {
  return revenue > 0 ? Math.round((fixed / revenue) * 1000) / 10 : null;
}

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

/** Totais de um mês (yyyy-mm) das linhas que são custo da empresa. */
export function summarizeCompanyCosts(lines: readonly CompanyCostInput[], month: string, revenue: number): MonthSummary {
  const inMonth = lines.filter((line) => line.dueDate.startsWith(month) && isCompanyCost(line));
  const groups = COMPANY_COST_GROUPS.map((group): GroupTotal => {
    const inGroup = inMonth.filter((line) => costGroupOf(line) === group);
    const fixed = sum(inGroup.filter((line) => line.isFixed).map((line) => line.amount));
    const variable = sum(inGroup.filter((line) => !line.isFixed).map((line) => line.amount));
    return {
      group,
      fixed,
      variable,
      total: fixed + variable,
      linkedToProjects: sum(inGroup.filter((line) => line.costScope === "projeto").map((line) => line.amount)),
      teamBreakdown: group === "equipe" ? teamBreakdown(inGroup) : [],
    };
  });
  const fixed = sum(groups.map((group) => group.fixed));
  const variable = sum(groups.map((group) => group.variable));
  return { groups, total: fixed + variable, fixed, variable, fixedShare: fixedShareOf(fixed, revenue) };
}
