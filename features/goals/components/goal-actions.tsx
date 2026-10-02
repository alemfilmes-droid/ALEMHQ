"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, Flag, MoreHorizontal, Pencil, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { formatCents } from "@/features/finance/money";
import { approveGoalAction, deleteGoalAction, setGoalStatusAction, syncGoalAction } from "@/features/goals/actions";
import { GoalFormDialog } from "@/features/goals/components/goal-form-dialog";
import { formatGoalValue, percentOf } from "@/features/goals/progress";
import type { GoalItem } from "@/features/goals/types";
import { addMonths, startOfMonth, todayInAppZone } from "@/lib/calendar";
import type { ActionResult } from "@/types";

interface GoalActionsProps {
  goal: GoalItem;
  isManager: boolean;
  owners: { id: string; name: string }[];
  /** O responsável já cadastrou os dados de pagamento (só a diretoria com financeiro sabe). */
  payeeHasDetails: boolean | null;
}

const pct = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** Dia 5 do mês seguinte ao fim da meta (o padrão de pagamento de comissão). */
function defaultDueDate(goal: GoalItem): string {
  const due = `${addMonths(startOfMonth(goal.endsOn), 1).slice(0, 8)}05`;
  const today = todayInAppZone();
  return due < today ? today : due;
}

function ApproveDialog({ goal, payeeHasDetails, onOpenChange }: { goal: GoalItem; payeeHasDetails: boolean | null; onOpenChange: (open: boolean) => void }) {
  const [dueDate, setDueDate] = useState(defaultDueDate(goal));
  const [pending, startTransition] = useTransition();
  const blocked = goal.pendingCount > 0;
  const percent = percentOf(goal.approved, goal.target);

  function approve() {
    startTransition(async () => {
      const result = await approveGoalAction(goal.id, dueDate);
      if (result.ok) {
        toast.success(result.message);
        onOpenChange(false);
      } else toast.error(result.error);
    });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Aprovar meta.</DialogTitle>
          <DialogDescription>
            Fecha a meta com o que foi aprovado. Se houver comissão, ela vira uma conta a pagar no financeiro em nome de {goal.ownerName}, com os dados de pagamento dele.
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-2 gap-4 rounded-lg border border-border p-4 text-sm">
          <div>
            <dt className="text-[12px] font-semibold text-muted-foreground">Atingido</dt>
            <dd className="font-bold">
              {formatGoalValue(goal, goal.approved)} ({pct.format(percent)}%)
            </dd>
          </div>
          <div>
            <dt className="text-[12px] font-semibold text-muted-foreground">Comissão</dt>
            <dd className="font-bold">
              <Money cents={goal.commissionConfirmed} />
            </dd>
          </div>
        </dl>

        {blocked ? (
          <Alert variant="error" title="Ainda há lançamentos a confirmar.">
            Aprove ou recuse os {goal.pendingCount} pendentes antes de fechar a meta.
          </Alert>
        ) : goal.commissionConfirmed > 0 ? (
          <>
            <FormField id="meta-vencimento" label="Pagar em">
              <Input id="meta-vencimento" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </FormField>
            {payeeHasDetails === false ? (
              <Alert title="Dados de pagamento não cadastrados.">
                A conta a pagar sai mesmo assim; peça para {goal.ownerName} preencher em Perfil → Dados para pagamento.
              </Alert>
            ) : null}
          </>
        ) : (
          <Alert title="Sem comissão a pagar.">
            Ficou abaixo de {pct.format(goal.minAchievementPct)}% da meta. A meta é fechada sem gerar pagamento.
          </Alert>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button onClick={approve} loading={pending} disabled={blocked || !dueDate}>
            {goal.commissionConfirmed > 0 ? `Aprovar e lançar ${formatCents(goal.commissionConfirmed)}` : "Aprovar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Ações do cabeçalho da meta: diretoria (editar, encerrar, aprovar, cancelar) e responsável (sincronizar). */
export function GoalActions({ goal, isManager, owners, payeeHasDetails }: GoalActionsProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [approving, setApproving] = useState(false);
  const [pending, startTransition] = useTransition();
  const open = goal.status === "ativa" || goal.status === "em_revisao";

  function run(action: () => Promise<ActionResult>, after?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message);
        after?.();
      } else toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {goal.autoFromCrm && goal.status === "ativa" ? (
        <Button variant="secondary" size="sm" loading={pending} onClick={() => run(() => syncGoalAction(goal.id))}>
          <RefreshCw aria-hidden />
          Sincronizar CRM
        </Button>
      ) : null}

      {isManager && open ? (
        <Button size="sm" onClick={() => setApproving(true)}>
          <CheckCircle2 aria-hidden />
          Aprovar meta
        </Button>
      ) : null}

      {isManager && goal.status !== "aprovada" ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="secondary" size="icon" className="size-8" aria-label="Mais ações da meta" disabled={pending}>
              <MoreHorizontal aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {open ? (
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <Pencil aria-hidden />
                Editar
              </DropdownMenuItem>
            ) : null}
            {goal.status === "ativa" ? (
              <DropdownMenuItem onSelect={() => run(() => setGoalStatusAction(goal.id, "em_revisao"))}>
                <Flag aria-hidden />
                Encerrar para revisão
              </DropdownMenuItem>
            ) : null}
            {goal.status === "em_revisao" || goal.status === "cancelada" ? (
              <DropdownMenuItem onSelect={() => run(() => setGoalStatusAction(goal.id, "ativa"))}>
                <RotateCcw aria-hidden />
                Reabrir
              </DropdownMenuItem>
            ) : null}
            {open ? (
              <DropdownMenuItem onSelect={() => run(() => setGoalStatusAction(goal.id, "cancelada"))}>
                <Ban aria-hidden />
                Cancelar meta
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              onSelect={() => {
                if (window.confirm("Apagar a meta e todos os lançamentos? Não dá para desfazer.")) {
                  run(() => deleteGoalAction(goal.id), () => router.push("/metas"));
                }
              }}
            >
              <Trash2 aria-hidden />
              Apagar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {editing ? <GoalFormDialog goal={goal} owners={owners} onOpenChange={setEditing} /> : null}
      {approving ? <ApproveDialog goal={goal} payeeHasDetails={payeeHasDetails} onOpenChange={setApproving} /> : null}
    </div>
  );
}
