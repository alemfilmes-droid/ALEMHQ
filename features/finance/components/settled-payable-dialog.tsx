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
import { PayableFields, payableValuesFrom } from "@/features/finance/components/payable-fields";
import { useSettledSubmit } from "@/features/finance/components/use-settled-submit";
import { centsToInput, parseMoneyToCents } from "@/features/finance/money";
import { settledPayableSchema, type PayableValues, type SettledPayableValues } from "@/features/finance/schemas";
import { editSettledPayableAction } from "@/features/finance/settled-actions";
import type { FinanceOptions, PayableItem } from "@/features/finance/types";
import { diffEntry, needsReason } from "@/lib/finance/settled-edit";
import { formatDate } from "@/lib/format";

interface SettledPayableDialogProps {
  payable: PayableItem;
  options: FinanceOptions;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lockedProjectId?: string;
}

function initialValues(item: PayableItem): SettledPayableValues {
  return {
    ...payableValuesFrom(item),
    paymentMethod: item.paymentMethod ?? ("" as SettledPayableValues["paymentMethod"]),
    paidAt: item.paidAt ?? "",
    receiptUrl: item.receiptUrl ?? "",
    lateReason: item.lateReason ?? "",
    penaltyAmount: item.penaltyAmount ? centsToInput(item.penaltyAmount) : "",
    penaltyReason: item.penaltyReason ?? "",
    reason: "",
  };
}

/** Editar um pagamento já baixado: todos os campos, a baixa e o motivo (obrigatório para valor/data). */
export function SettledPayableDialog({ payable, options, open, onOpenChange, lockedProjectId }: SettledPayableDialogProps) {
  const { submit, pending, failure } = useSettledSubmit(onOpenChange);
  const form = useForm<SettledPayableValues>({ resolver: zodResolver(settledPayableSchema), defaultValues: initialValues(payable) });
  const { register, control, handleSubmit, setError, formState: { errors } } = form;
  const [amount, paidAt, dueDate] = useWatch({ control, name: ["amount", "paidAt", "dueDate"] });
  const amountCents = parseMoneyToCents(amount);
  const reasonRequired = needsReason(
    "payable",
    diffEntry("payable", { amount: payable.amount / 100, paid_at: payable.paidAt }, { amount: amountCents === null ? null : amountCents / 100, paid_at: paidAt }),
  );
  const late = !!paidAt && !!dueDate && paidAt > dueDate;

  const onSubmit = handleSubmit((values) => {
    if (reasonRequired && values.reason.trim().length < 3) {
      setError("reason", { message: "Informe o motivo: o valor ou a data de pagamento mudou." });
      return;
    }
    submit(() => editSettledPayableAction(payable.id, payable.version, values));
  });

  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <DialogContent className="max-w-2xl p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Editar pagamento baixado.</DialogTitle>
          <DialogDescription>
            Pago em {payable.paidAt ? formatDate(payable.paidAt) : "—"}. Tudo o que mudar fica no histórico de alterações.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <ActionError message={failure?.message ?? null} reload={failure?.reload} />
          {/* Os campos do pagamento são os mesmos da criação (mesmo formulário, mesmas regras). */}
          <PayableFields form={form as unknown as UseFormReturn<PayableValues>} options={options} lockedProjectId={lockedProjectId} settled />

          <fieldset className="space-y-4 rounded-md border border-border-strong p-3">
            <legend className="eyebrow px-1">Baixa</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="settled-paid-at" label="Data do pagamento" error={errors.paidAt?.message}>
                <Input id="settled-paid-at" type="date" {...register("paidAt")} />
              </FormField>
              <FormField id="settled-method" label="Forma de pagamento" error={errors.paymentMethod?.message}>
                <Controller
                  control={control}
                  name="paymentMethod"
                  render={({ field }) => <MethodSelect id="settled-method" value={field.value ?? ""} onChange={field.onChange} invalid={!!errors.paymentMethod} />}
                />
              </FormField>
            </div>
            <FormField id="settled-receipt" label="Link do comprovante (opcional)" error={errors.receiptUrl?.message}>
              <Input id="settled-receipt" type="url" placeholder="https://" {...register("receiptUrl")} />
            </FormField>
            {late ? (
              <FormField id="settled-late" label="Motivo do atraso" error={errors.lateReason?.message}>
                <Textarea id="settled-late" rows={2} aria-invalid={!!errors.lateReason} {...register("lateReason")} />
              </FormField>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
              <FormField id="settled-penalty" label="Multa/juros (R$)" hint="Opcional." error={errors.penaltyAmount?.message}>
                <Input id="settled-penalty" inputMode="decimal" {...register("penaltyAmount")} />
              </FormField>
              <FormField id="settled-penalty-reason" label="Motivo da multa/juros" error={errors.penaltyReason?.message}>
                <Input id="settled-penalty-reason" {...register("penaltyReason")} />
              </FormField>
            </div>
            <p className="text-[12px] text-muted-foreground">O valor do pagamento é o total pago (com multa/juros, se houve).</p>
          </fieldset>

          <ChangeReasonField id="settled-reason" required={reasonRequired} error={errors.reason?.message} registration={register("reason")} />

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
