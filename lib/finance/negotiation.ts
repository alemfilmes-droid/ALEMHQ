/**
 * "Em negociação" — regra única do card do Dashboard e da gaveta de detalhe. Recebe os candidatos crus de
 * public.finance_negotiation_pipeline() e decide o que soma:
 *
 * - Orçamento conta em Enviado ao cliente, Em análise e Em ajuste. Rascunho não conta; Não aprovado e Aprovado
 *   saem do total.
 * - Várias versões do mesmo número (Refazer): vale só a última que já saiu do rascunho — a v2 em rascunho não
 *   tira a v1 em ajuste da conta, e a v2 enviada substitui a v1.
 * - Negócio do CRM com orçamento ligado: conta só o orçamento (nunca os dois).
 * - Previsão ponderada: valor × probabilidade da etapa do negócio. Orçamento ligado a negócio usa a etapa do
 *   negócio; orçamento sem CRM não tem probabilidade e fica fora da ponderada.
 *
 * Valores em centavos inteiros.
 */

export type NegotiationOrigin = "crm" | "orcamento";

export const COUNTED_BUDGET_STATUSES = ["enviado", "em_analise", "em_ajuste"] as const;
export type CountedBudgetStatus = (typeof COUNTED_BUDGET_STATUSES)[number];

export interface BudgetCandidate {
  id: string;
  number: number;
  version: number;
  status: string;
  dealId: string | null;
  companyId: string | null;
  clientName: string;
  title: string;
  totalCents: number;
  /** Probabilidade da etapa do negócio ligado (0–1); sem negócio, null. */
  probability: number | null;
  updatedAt: string;
}

export interface DealCandidate {
  id: string;
  code: string;
  companyId: string;
  clientName: string;
  title: string;
  /** Status da última proposta (enviada, em_negociacao…). */
  status: string;
  stage: string;
  amountCents: number;
  probability: number;
  updatedAt: string;
}

export interface NegotiationEntry {
  key: string;
  origin: NegotiationOrigin;
  id: string;
  label: string;
  companyId: string | null;
  clientName: string;
  description: string;
  status: string;
  amountCents: number;
  /** null = sem probabilidade (orçamento fora do CRM). */
  weightedCents: number | null;
  updatedAt: string;
  href: string;
}

export interface NegotiationSummary {
  entries: NegotiationEntry[];
  count: number;
  totalCents: number;
  weightedCents: number;
  byOrigin: Record<NegotiationOrigin, { count: number; totalCents: number }>;
}

export function budgetLabel(number: number, version: number): string {
  return `Orçamento ${String(number).padStart(4, "0")}${version > 1 ? ` v${version}` : ""}`;
}

function isCounted(status: string): status is CountedBudgetStatus {
  return (COUNTED_BUDGET_STATUSES as readonly string[]).includes(status);
}

/** Por número de orçamento: a versão mais alta que já saiu do rascunho. */
function latestSentVersions(budgets: readonly BudgetCandidate[]): BudgetCandidate[] {
  const byNumber = new Map<number, BudgetCandidate>();
  for (const budget of budgets) {
    if (budget.status === "rascunho") continue;
    const current = byNumber.get(budget.number);
    if (!current || budget.version > current.version) byNumber.set(budget.number, budget);
  }
  return [...byNumber.values()];
}

export function buildNegotiation(budgets: readonly BudgetCandidate[], deals: readonly DealCandidate[]): NegotiationSummary {
  // Qualquer orçamento (não arquivado) ligado ao negócio, em qualquer status, faz o orçamento ser a fonte.
  const dealsWithBudget = new Set(budgets.flatMap((budget) => (budget.dealId ? [budget.dealId] : [])));

  const budgetEntries: NegotiationEntry[] = latestSentVersions(budgets)
    .filter((budget) => isCounted(budget.status) && budget.totalCents > 0)
    .map((budget) => ({
      key: `orcamento:${budget.id}`,
      origin: "orcamento",
      id: budget.id,
      label: budgetLabel(budget.number, budget.version),
      companyId: budget.companyId,
      clientName: budget.clientName,
      description: budget.title,
      status: budget.status,
      amountCents: budget.totalCents,
      weightedCents: budget.dealId && budget.probability !== null ? Math.round(budget.totalCents * budget.probability) : null,
      updatedAt: budget.updatedAt,
      href: `/orcamentos/${budget.id}`,
    }));

  const dealEntries: NegotiationEntry[] = deals
    .filter((deal) => !dealsWithBudget.has(deal.id) && deal.amountCents > 0)
    .map((deal) => ({
      key: `crm:${deal.id}`,
      origin: "crm",
      id: deal.id,
      label: deal.code,
      companyId: deal.companyId,
      clientName: deal.clientName,
      description: deal.title,
      status: deal.status,
      amountCents: deal.amountCents,
      weightedCents: Math.round(deal.amountCents * deal.probability),
      updatedAt: deal.updatedAt,
      href: `/crm?aba=leads&negocio=${deal.id}`,
    }));

  const entries = [...budgetEntries, ...dealEntries].sort((a, b) => b.amountCents - a.amountCents || b.updatedAt.localeCompare(a.updatedAt));
  const subtotal = (origin: NegotiationOrigin) => {
    const items = entries.filter((entry) => entry.origin === origin);
    return { count: items.length, totalCents: items.reduce((sum, entry) => sum + entry.amountCents, 0) };
  };
  return {
    entries,
    count: entries.length,
    totalCents: entries.reduce((sum, entry) => sum + entry.amountCents, 0),
    weightedCents: entries.reduce((sum, entry) => sum + (entry.weightedCents ?? 0), 0),
    byOrigin: { crm: subtotal("crm"), orcamento: subtotal("orcamento") },
  };
}
