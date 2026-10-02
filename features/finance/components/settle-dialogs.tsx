"use client";

import { Money } from "@/components/ui/money";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
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
    defaultValues: { paidAt: today, paymentMethod: payable.paymentMethod ?? undefined },
  });

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
          <DialogTitle>Marcar como pago.</DialogTitle>
          <DialogDescription>
            {payable.description} · <Money cents={payable.amount} />
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
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              Confirmar pagamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
