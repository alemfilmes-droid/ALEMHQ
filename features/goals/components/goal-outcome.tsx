import { CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import type { GoalItem } from "@/features/goals/types";
import { missingPct } from "@/lib/goals/finalize";
import { formatDate } from "@/lib/format";

const pct = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/**
 * Resultado de uma meta encerrada: "Meta batida" em verde com a comissão; "Meta não alcançada" no vermelho de
 * erro do HQ (--status-danger, nunca o vermelho da marca) com quanto faltou.
 */
export function GoalOutcomeBadge({ goal }: { goal: Pick<GoalItem, "outcome" | "finalCommission" | "finalAchieved" | "approved" | "target"> }) {
  if (goal.outcome === "batida") {
    return (
      <Badge variant="outline" className="shrink-0 border-[var(--status-success)] text-foreground">
        <CheckCircle2 aria-hidden style={{ color: "var(--status-success)" }} />
        Meta batida{goal.finalCommission ? <> · <Money cents={goal.finalCommission} /></> : null}
      </Badge>
    );
  }
  if (goal.outcome === "nao_batida") {
    return (
      <Badge variant="outline" className="shrink-0 border-[var(--status-danger)] text-foreground">
        <XCircle aria-hidden style={{ color: "var(--status-danger)" }} />
        Meta não alcançada · faltaram {pct.format(missingPct(goal.finalAchieved ?? goal.approved, goal.target))}%
      </Badge>
    );
  }
  return null;
}

export interface CommissionPayment {
  amount: number;
  dueDate: string;
  scheduledFor: string | null;
  paidAt: string | null;
}

/** "Comissão agendada" → "Comissão paga" (o dono e a diretoria veem; o pagamento é do financeiro). */
export function CommissionHistory({ payments }: { payments: CommissionPayment[] }) {
  if (payments.length === 0) return <p className="text-sm text-muted-foreground">Nenhum pagamento de comissão lançado ainda.</p>;
  return (
    <ul className="space-y-2 text-sm">
      {payments.map((payment, index) => (
        <li key={index} className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-border p-3">
          <span className="font-semibold">{payment.paidAt ? "Comissão paga" : "Comissão agendada"}</span>
          <span className="text-muted-foreground">
            <Money cents={payment.amount} /> · {payment.paidAt ? `paga em ${formatDate(payment.paidAt)}` : `para ${formatDate(payment.scheduledFor ?? payment.dueDate)}`}
          </span>
        </li>
      ))}
    </ul>
  );
}
