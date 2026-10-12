"use client";

import { Controller, useForm, useWatch, type UseFormReturn } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ActionError } from "@/components/ui/action-error";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChangeReasonField } from "@/features/finance/components/change-reason-field";
import { MethodSelect } from "@/features/finance/components/method-select";
import { ReceivableIdentityFields, type ReceivableIdentityValues } from "@/features/finance/components/receivable-identity-fields";
import { useSettledSubmit } from "@/features/finance/components/use-settled-submit";
import { centsToInput, parseMoneyToCents } from "@/features/finance/money";
import { settledReceivableSchema, type SettledReceivableValues } from "@/features/finance/schemas";
import { editSettledReceivableAction } from "@/features/finance/settled-actions";
import type { FinanceOptions, ReceivableItem } from "@/features/finance/types";
import { diffEntry, needsReason } from "@/lib/finance/settled-edit";
import { formatDate } from "@/lib/format";

interface SettledReceivableDialogProps {
  receivable: ReceivableItem;
  options: FinanceOptions;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function initialValues(item: ReceivableItem): SettledReceivableValues {
  return {
    companyId: item.companyId,
    projectId: item.projectId ?? "",
    description: item.description,
    serviceDescription: item.serviceDescription ?? "",
    competenceMonth: item.competenceMonth ?? "",
    amount: centsToInput(item.amount),
    dueDate: item.dueDate,
    paymentMethod: item.paymentMethod ?? ("" as SettledReceivableValues["paymentMethod"]),
    invoiceNumber: item.invoiceNumber ?? "",
    notes: item.notes ?? "",
    requiresInvoice: item.requiresInvoice,
    receivedAt: item.receivedAt ?? "",
    receivedAmount: centsToInput(item.receivedAmount ?? item.amount),
    reason: "",
  };
}

const toNumber = (input: string) => {
  const cents = parseMoneyToCents(input);
  return cents === null ? null : cents / 100;
};

/** Editar um recebimento já baixado: todos os campos, a baixa e o motivo (obrigatório para valor/data). */
export function SettledReceivableDialog({ receivable, options, open, onOpenChange }: SettledReceivableDialogProps) {
  const { submit, pending, failure } = useSettledSubmit(onOpenChange);
  const form = useForm<SettledReceivableValues>({ resolver: zodResolver(settledReceivableSchema), defaultValues: initialValues(receivable) });
  const { register, control, handleSubmit, setError, formState: { errors } } = form;
  const [amount, receivedAmount, receivedAt] = useWatch({ control, name: ["amount", "receivedAmount", "receivedAt"] });
  const reasonRequired = needsReason(
    "receivable",
    diffEntry(
      "receivable",
      { amount: receivable.amount / 100, received_amount: receivable.receivedAmount === null ? null : receivable.receivedAmount / 100, received_at: receivable.receivedAt },
      { amount: toNumber(amount), received_amount: toNumber(receivedAmount), received_at: receivedAt },
    ),
  );

  const onSubmit = handleSubmit((values) => {
    if (reasonRequired && values.reason.trim().length < 3) {
      setError("reason", { message: "Informe o motivo: o valor ou a data de recebimento mudou." });
      return;
    }
    submit(() => editSettledReceivableAction(receivable.id, receivable.version, values));
  });

  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <DialogContent className="max-w-2xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Editar recebimento baixado.</DialogTitle>
          <DialogDescription>
            Recebido em {receivable.receivedAt ? formatDate(receivable.receivedAt) : "—"}. Tudo o que mudar fica no histórico de alterações.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <ActionError message={failure?.message ?? null} reload={failure?.reload} />
          <ReceivableIdentityFields form={form as unknown as UseFormReturn<ReceivableIdentityValues>} options={options} />

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField id="settled-rec-amount" label="Valor previsto (R$)" error={errors.amount?.message}>
              <Input id="settled-rec-amount" inputMode="decimal" aria-invalid={!!errors.amount} {...register("amount")} />
            </FormField>
            <FormField id="settled-rec-due" label="Vencimento" error={errors.dueDate?.message}>
              <Input id="settled-rec-due" type="date" {...register("dueDate")} />
            </FormField>
            <FormField id="settled-rec-invoice" label="Nota fiscal" error={errors.invoiceNumber?.message}>
              <Input id="settled-rec-invoice" {...register("invoiceNumber")} />
            </FormField>
          </div>

          <fieldset className="space-y-4 rounded-md border border-border-strong p-3">
            <legend className="eyebrow px-1">Baixa</legend>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField id="settled-rec-at" label="Data do recebimento" error={errors.receivedAt?.message}>
                <Input id="settled-rec-at" type="date" {...register("receivedAt")} />
              </FormField>
              <FormField id="settled-rec-received" label="Valor recebido (R$)" error={errors.receivedAmount?.message}>
                <Input id="settled-rec-received" inputMode="decimal" aria-invalid={!!errors.receivedAmount} {...register("receivedAmount")} />
              </FormField>
              <FormField id="settled-rec-method" label="Forma de pagamento" error={errors.paymentMethod?.message}>
                <Controller
                  control={control}
                  name="paymentMethod"
                  render={({ field }) => <MethodSelect id="settled-rec-method" value={field.value ?? ""} onChange={field.onChange} invalid={!!errors.paymentMethod} />}
                />
              </FormField>
            </div>
          </fieldset>

          <FormField id="settled-rec-notes" label="Observações" error={errors.notes?.message}>
            <Textarea id="settled-rec-notes" {...register("notes")} />
          </FormField>

          <ChangeReasonField id="settled-rec-reason" required={reasonRequired} error={errors.reason?.message} registration={register("reason")} />

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary" size="lg" disabled={pending}>
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" size="lg" loading={pending}>
              {pending ? "Salvando…" : "Salvar alterações"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
