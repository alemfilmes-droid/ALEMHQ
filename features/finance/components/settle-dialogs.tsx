"use client";

import { Money } from "@/components/ui/money";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { settlePayableAction, settleReceivableAction } from "@/features/finance/actions";
import { requestProjectFinalizeCheck } from "@/features/projects/finalize-events";
import { MethodSelect } from "@/features/finance/components/method-select";
import { centsToInput } from "@/features/finance/money";
import {
  settlePayableSchema,
  settleReceivableSchema,
  type SettlePayableValues,
  type SettleReceivableValues,
} from "@/features/finance/schemas";
import type { PayableItem, ReceivableItem } from "@/features/finance/types";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";

interface DialogState {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  today: string;
}

export function SettleReceivableDialog({ receivable, open, onOpenChange, today }: DialogState & { receivable: ReceivableItem }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SettleReceivableValues>({
    resolver: zodResolver(settleReceivableSchema),
    defaultValues: {
      receivedAt: today,
      receivedAmount: centsToInput(receivable.amount),
      paymentMethod: receivable.paymentMethod ?? undefined,
      invoiceNumber: receivable.invoiceNumber ?? "",
    },
  });

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await settleReceivableAction(receivable.id, values);
      if (result.ok) {
        toast.success(result.message);
        onOpenChange(false);
        // Último pagamento de um projeto com tudo aprovado: oferece finalizar o projeto.
        requestProjectFinalizeCheck(receivable.projectId);
      } else {
        setError(result.error);
      }
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marcar como recebido.</DialogTitle>
          <DialogDescription>
            {receivable.description} · previsto <Money cents={receivable.amount} />
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {error ? <Alert variant="error">{error}</Alert> : null}
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField id="settle-date" label="Data do recebimento" error={errors.receivedAt?.message}>
              <Input id="settle-date" type="date" {...register("receivedAt")} />
            </FormField>
            <FormField id="settle-amount" label="Valor recebido (R$)" error={errors.receivedAmount?.message}>
              <Input id="settle-amount" inputMode="decimal" {...register("receivedAmount")} />
            </FormField>
            <FormField id="settle-method" label="Forma de pagamento" error={errors.paymentMethod?.message}>
              <Controller
                control={control}
                name="paymentMethod"
                render={({ field }) => (
                  <MethodSelect id="settle-method" value={field.value ?? ""} onChange={field.onChange} invalid={!!errors.paymentMethod} />
                )}
              />
            </FormField>
            <FormField id="settle-invoice" label="Nota fiscal" error={errors.invoiceNumber?.message}>
              <Input id="settle-invoice" {...register("invoiceNumber")} />
            </FormField>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              Confirmar recebimento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Dar baixa no pagamento. Data depois do vencimento: o motivo do atraso é obrigatório e a pergunta
 * de multa/juros aparece (valor e motivo entram no custo, para a margem refletir o valor real).
 */
export function SettlePayableDialog({ payable, open, onOpenChange, today }: DialogState & { payable: PayableItem }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<SettlePayableValues>({
    resolver: zodResolver(settlePayableSchema),
    defaultValues: {
      paidAt: today,
      dueDate: payable.dueDate,
      paymentMethod: payable.paymentMethod ?? undefined,
      receiptUrl: "",
      lateReason: "",
      hadPenalty: false,
      penaltyAmount: "",
      penaltyReason: "",
    },
  });
  const [paidAt, hadPenalty] = useWatch({ control, name: ["paidAt", "hadPenalty"] });
  const late = !!paidAt && paidAt > payable.dueDate;

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await settlePayableAction(payable.id, values);
      if (result.ok) {
        toast.success(result.message);
        onOpenChange(false);
      } else {
        setError(result.error);
      }
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dar baixa no pagamento.</DialogTitle>
          <DialogDescription>
            {payable.payeeLabel} · {payable.description} · <Money cents={payable.amount} /> · vence {formatDate(payable.dueDate)}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {error ? <Alert variant="error">{error}</Alert> : null}
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField id="pay-date" label="Data do pagamento" error={errors.paidAt?.message}>
              <Input id="pay-date" type="date" {...register("paidAt")} />
            </FormField>
            <FormField id="pay-method" label="Forma de pagamento" error={errors.paymentMethod?.message}>
              <Controller
                control={control}
                name="paymentMethod"
                render={({ field }) => (
                  <MethodSelect id="pay-method" value={field.value ?? ""} onChange={field.onChange} invalid={!!errors.paymentMethod} />
                )}
              />
            </FormField>
          </div>
          <FormField id="pay-receipt" label="Link do comprovante (opcional)" error={errors.receiptUrl?.message}>
            <Input id="pay-receipt" type="url" placeholder="https://" {...register("receiptUrl")} />
          </FormField>

          {late ? (
            <fieldset className="space-y-4 rounded-md border border-border-strong p-3">
              <legend className="eyebrow px-1">Pago depois do vencimento ({formatDate(payable.dueDate)})</legend>
              <FormField id="pay-late-reason" label="Motivo do atraso" error={errors.lateReason?.message}>
                <Textarea id="pay-late-reason" rows={2} aria-invalid={!!errors.lateReason} {...register("lateReason")} />
              </FormField>
              <label className="flex items-center gap-2 text-sm">
                <Controller control={control} name="hadPenalty" render={({ field }) => <Checkbox checked={field.value} onCheckedChange={(value) => field.onChange(value === true)} />} />
                Houve multa ou juros
              </label>
              {hadPenalty ? (
                <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
                  <FormField id="pay-penalty" label="Valor (R$)" error={errors.penaltyAmount?.message}>
                    <Input id="pay-penalty" inputMode="decimal" aria-invalid={!!errors.penaltyAmount} {...register("penaltyAmount")} />
                  </FormField>
                  <FormField id="pay-penalty-reason" label="Motivo da multa/juros" error={errors.penaltyReason?.message}>
                    <Input id="pay-penalty-reason" aria-invalid={!!errors.penaltyReason} {...register("penaltyReason")} />
                  </FormField>
                </div>
              ) : null}
              {hadPenalty ? <p className="text-[12px] text-muted-foreground">A multa/juros soma no custo: a margem do projeto passa a refletir o valor real pago.</p> : null}
            </fieldset>
          ) : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              Confirmar baixa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
