"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { ActionError } from "@/components/ui/action-error";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { parseMoneyToCents } from "@/features/finance/money";
import { finalizeGoalAction } from "@/features/goals/actions";
import { formatGoalValue, percentOf } from "@/features/goals/progress";
import type { GoalItem } from "@/features/goals/types";
import { needsReload, runAction } from "@/lib/actions/client-action";
import { finalizeGoal } from "@/lib/goals/finalize";
import { cn } from "@/lib/utils";

const pct = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/**
 * "Finalizar meta" (CEO/admin). Meta batida: percentual → o CEO informa o valor final em R$; valor fixo → o valor
 * aparece para confirmar. Meta não alcançada: mostra quanto faltou. Não cria pagamento — o financeiro agenda.
 */
export function FinalizeGoalDialog({ goal, onOpenChange }: { goal: GoalItem; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [reached, setReached] = useState<boolean | null>(goal.approved >= goal.target ? true : null);
  const [amount, setAmount] = useState("");
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<{ message: string; reload: boolean } | null>(null);
  const blocked = goal.pendingCount > 0;
  const preview =
    reached === null
      ? null
      : finalizeGoal({ mode: goal.commissionMode, rate: goal.commissionRate, target: goal.target, achieved: goal.approved, reached, enteredCommission: parseMoneyToCents(amount) });

  function confirm() {
    if (reached === null) return;
    setFailure(null);
    startTransition(async () => {
      const result = await runAction(() => finalizeGoalAction(goal.id, reached, goal.commissionMode === "percentual" && reached ? amount : ""));
      if (!result.ok) return setFailure({ message: result.error, reload: needsReload(result) });
      toast.success(result.message);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Finalizar meta.</DialogTitle>
          <DialogDescription>
            {goal.title} · {goal.ownerName}: {formatGoalValue(goal, goal.approved)} de {formatGoalValue(goal, goal.target)} ({pct.format(percentOf(goal.approved, goal.target))}%)
          </DialogDescription>
        </DialogHeader>
        {blocked ? <p className="text-sm font-semibold">Revise os {goal.pendingCount} lançamentos pendentes antes de finalizar.</p> : null}
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Resultado da meta">
          {(
            [
              [true, "Meta batida", CheckCircle2],
              [false, "Meta não alcançada", XCircle],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={reached === value}
              onClick={() => setReached(value)}
              className={cn(
                "flex min-h-11 items-center justify-center gap-2 rounded-md border px-3 text-sm font-semibold",
                reached === value ? "border-foreground bg-surface-hover" : "border-border-strong text-muted-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden style={{ color: value ? "var(--status-success)" : "var(--status-danger)" }} />
              {label}
            </button>
          ))}
        </div>

        {reached && goal.commissionMode === "percentual" ? (
          <FormField id="finalize-amount" label="Valor final da comissão (R$)" hint="Já calculado: entra como “Meta batida” e no aviso ao financeiro.">
            <Input id="finalize-amount" inputMode="decimal" placeholder="0,00" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </FormField>
        ) : null}
        {preview?.ok && reached && goal.commissionMode !== "percentual" ? (
          <p className="text-sm">
            Comissão: <strong><Money cents={preview.commission} /></strong>. Confirme para finalizar.
          </p>
        ) : null}
        {reached === false && preview?.ok ? (
          <p className="text-sm">
            Faltaram <strong style={{ color: "var(--status-danger)" }}>{pct.format(preview.missingPct)}%</strong>. Sem comissão.
          </p>
        ) : null}
        <p className="text-[13px] text-muted-foreground">
          O pagamento não é criado aqui: você e o financeiro recebem o aviso para agendar, e o financeiro lança em Pagamentos como “Comissão”.
        </p>
        <ActionError message={failure?.message ?? null} reload={failure?.reload} />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" size="lg" disabled={pending}>
              Voltar
            </Button>
          </DialogClose>
          <Button type="button" size="lg" loading={pending} disabled={blocked || reached === null || (preview !== null && !preview.ok)} onClick={confirm}>
            Finalizar meta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
