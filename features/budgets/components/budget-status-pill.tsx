import { Badge } from "@/components/ui/badge";
import { TintedPill } from "@/components/ui/tinted-pill";
import { BUDGET_STATUS_LABELS, type BudgetStatus } from "@/features/budgets/types";
import { TINTS, type Tint } from "@/lib/theme/tint";

/**
 * Cor do status do orçamento: Aprovado = verde; Não aprovado = vermelho suave das "Saídas" (nunca o da marca);
 * Enviado ao cliente e Em análise = neutro preenchido; Rascunho e Em ajuste = contorno, como antes.
 */
const STATUS_TINT: Partial<Record<BudgetStatus, Tint>> = {
  aprovado: TINTS.success,
  recusado: TINTS.danger,
  enviado: TINTS.neutralFilled,
  em_analise: TINTS.neutralFilled,
};

export function BudgetStatusPill({ status }: { status: BudgetStatus }) {
  const tint = STATUS_TINT[status];
  return tint ? <TintedPill tint={tint}>{BUDGET_STATUS_LABELS[status]}</TintedPill> : <Badge variant="outline">{BUDGET_STATUS_LABELS[status]}</Badge>;
}
