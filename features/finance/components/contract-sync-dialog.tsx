"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  applyContractChangeAction,
  previewContractChangeAction,
  type ContractMode,
  type ContractPlanRow,
  type ContractStatus,
} from "@/features/finance/contract-actions";
import { formatCents } from "@/features/finance/money";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const OP_LABELS: Record<ContractPlanRow["op"], string> = {
  contrato: "Contrato",
  cancelar: "Cancelar parcela",
  reduzir: "Reduzir parcela",
  criar: "Nova parcela",
  aviso: "Atenção",
};

interface ContractSyncDialogProps {
  budgetId: string;
  status: ContractStatus;
  onDone: () => void;
}

/**
 * O orçamento mudou o valor de um projeto que já tem contrato: o financeiro escolhe substituir,
 * somar como serviço adicional ou manter — e vê antes o que acontece com as parcelas.
 */
export function ContractSyncDialog({ budgetId, status, onDone }: ContractSyncDialogProps) {
  const current = status.contractValue ?? 0;
  const [mode, setMode] = useState<Exclude<ContractMode, "definicao">>("substituicao");
  const [description, setDescription] = useState("Serviço adicional");
  const [note, setNote] = useState("");
  const canRegenerate = status.receivedCount === 0 && status.pendingCount > 0;
  const [regenerate, setRegenerate] = useState(canRegenerate);
  const [plan, setPlan] = useState<ContractPlanRow[] | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    setPlan(null);
    setPlanError(null);
    void previewContractChangeAction({
      projectId: status.projectId,
      mode,
      amount: status.budgetTotal,
      regenerate,
      description: mode === "adicional" ? description : "",
    }).then((result) => {
      if (!active) return;
      if (result.ok) setPlan(result.rows);
      else setPlanError(result.error);
    });
    return () => {
      active = false;
    };
  }, [mode, regenerate, description, status.projectId, status.budgetTotal]);

  function confirm() {
    startTransition(async () => {
      const result = await applyContractChangeAction({
        projectId: status.projectId,
        budgetId,
        mode,
        amount: status.budgetTotal,
        regenerate,
        description: mode === "adicional" ? description : "",
        note,
      });
      if (result.ok) {
        toast.success(result.message);
        onDone();
      } else toast.error(result.error);
    });
  }

  const options: { value: Exclude<ContractMode, "definicao">; title: string; detail: string }[] = [
    {
      value: "substituicao",
      title: "Substituir o valor do contrato",
      detail: `${formatCents(current)} → ${formatCents(status.budgetTotal)}. Use quando o escopo foi reprecificado.`,
    },
    {
      value: "adicional",
      title: "Somar como serviço adicional",
      detail: `${formatCents(current)} + ${formatCents(status.budgetTotal)} = ${formatCents(current + status.budgetTotal)}. Fica registrado como uma linha separada.`,
    },
    { value: "manter", title: "Manter o valor atual", detail: `O orçamento fica registrado; o contrato continua ${formatCents(current)}.` },
  ];

  return (
    <Dialog open onOpenChange={(next) => !next && onDone()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>O valor do projeto mudou.</DialogTitle>
          <DialogDescription>
            {status.projectName}: o contrato é de {formatCents(current)} e este orçamento soma {formatCents(status.budgetTotal)}. Como aplicar?
          </DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-2">
          <legend className="sr-only">Como aplicar o valor</legend>
          {options.map((option) => (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors",
                mode === option.value ? "border-foreground bg-surface-raised" : "border-border hover:bg-surface-hover",
              )}
            >
              <input type="radio" name="contract-mode" value={option.value} checked={mode === option.value} onChange={() => setMode(option.value)} className="mt-1 accent-current" />
              <span>
                <span className="block text-sm font-bold">{option.title}</span>
                <span className="block text-[13px] text-muted-foreground">{option.detail}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {mode === "adicional" ? (
          <FormField id="contract-description" label="Descrição do serviço adicional">
            <Input id="contract-description" value={description} maxLength={200} onChange={(event) => setDescription(event.target.value)} />
          </FormField>
        ) : null}

        {mode !== "manter" && canRegenerate ? (
          <label className="flex items-start gap-3 text-sm">
            <Checkbox checked={regenerate} onCheckedChange={(value) => setRegenerate(value === true)} className="mt-0.5" />
            <span>
              Nenhuma parcela foi recebida: <strong>regenerar as {status.pendingCount} parcelas</strong> com o total novo, nas mesmas datas.
              <span className="block text-[13px] text-muted-foreground">Desmarcado, só a diferença vira uma parcela nova.</span>
            </span>
          </label>
        ) : null}
        {status.receivedCount > 0 && mode !== "manter" ? (
          <p className="text-[13px] text-muted-foreground">
            Já há {status.receivedCount} parcela(s) recebida(s): elas não mudam. Só a diferença é lançada (ou abatida das pendentes).
          </p>
        ) : null}

        <div className="space-y-2">
          <p className="eyebrow">O que vai acontecer</p>
          {planError ? (
            <Alert variant="error">{planError}</Alert>
          ) : !plan ? (
            <Skeleton className="h-20 w-full" />
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border text-sm" data-sensitive>
              {plan.map((row, index) => (
                <li key={index} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2">
                  <span className="min-w-0">
                    <span className="font-semibold">{OP_LABELS[row.op]}</span>
                    <span className="text-muted-foreground"> · {row.description}</span>
                    {row.dueDate ? <span className="text-subtle"> · vence {formatDate(row.dueDate)}</span> : null}
                  </span>
                  <span className="whitespace-nowrap tabular-nums">
                    {row.previousAmount != null && row.op !== "cancelar" ? <span className="text-subtle line-through">{formatCents(row.previousAmount)}</span> : null}{" "}
                    <strong className={row.op === "cancelar" ? "line-through" : undefined}>{formatCents(row.amount)}</strong>
                  </span>
                </li>
              ))}
              {plan.length === 1 && mode !== "manter" ? <li className="px-3 py-2 text-[13px] text-muted-foreground">Nenhuma parcela muda.</li> : null}
            </ul>
          )}
        </div>

        <FormField id="contract-note" label="Observação (opcional)">
          <Textarea id="contract-note" rows={2} maxLength={500} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ex.: cliente pediu mais 2 reels." />
        </FormField>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onDone}>
            Decidir depois
          </Button>
          <Button type="button" onClick={confirm} loading={pending} disabled={!plan}>
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
