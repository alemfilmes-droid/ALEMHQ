"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ListPlus } from "lucide-react";
import { toast } from "sonner";
import { generateProjectInstallmentsAction } from "@/features/finance/actions";
import { MethodSelect } from "@/features/finance/components/method-select";
import { formatCents, splitInstallments, type Cents } from "@/features/finance/money";
import { projectInstallmentsSchema, type ProjectInstallmentsValues } from "@/features/finance/schemas";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

interface GenerateInstallmentsDialogProps {
  projectId: string;
  contractCents: Cents | null;
  hasOpenReceivables: boolean;
  today: string;
}

export function GenerateInstallmentsDialog({ projectId, contractCents, hasOpenReceivables, today }: GenerateInstallmentsDialogProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<ProjectInstallmentsValues>({
    resolver: zodResolver(projectInstallmentsSchema),
    defaultValues: { installments: "3", firstDueDate: today, intervalDays: "30", paymentMethod: "" },
  });
  const count = Number(watch("installments")) || 0;
  const preview = contractCents && count > 0 && count <= 120 ? splitInstallments(contractCents, count) : null;

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await generateProjectInstallmentsAction(projectId, values);
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
      } else {
        setError(result.error);
      }
    });
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setError(null);
        if (next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm" disabled={!contractCents}>
          <ListPlus aria-hidden />
          Gerar parcelas a partir do contrato
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerar parcelas.</DialogTitle>
          <DialogDescription>Total do contrato: {contractCents ? formatCents(contractCents) : "—"}.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {hasOpenReceivables ? (
            <Alert variant="info">Este projeto já tem recebimentos. As novas parcelas somam ao que existe.</Alert>
          ) : null}
          {error ? <Alert variant="error">{error}</Alert> : null}
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField id="gen-count" label="Parcelas" error={errors.installments?.message}>
              <Input id="gen-count" inputMode="numeric" {...register("installments")} />
            </FormField>
            <FormField id="gen-interval" label="Intervalo (dias)" error={errors.intervalDays?.message}>
              <Input id="gen-interval" inputMode="numeric" {...register("intervalDays")} />
            </FormField>
            <FormField id="gen-first" label="Primeiro vencimento" error={errors.firstDueDate?.message}>
              <Input id="gen-first" type="date" {...register("firstDueDate")} />
            </FormField>
            <FormField id="gen-method" label="Forma de pagamento">
              <Controller
                control={control}
                name="paymentMethod"
                render={({ field }) => <MethodSelect id="gen-method" optional value={field.value} onChange={field.onChange} />}
              />
            </FormField>
          </div>
          {preview ? (
            <p className="rounded-md border border-border bg-surface-raised p-3 text-[13px] text-muted-foreground">
              {count} parcelas, de {formatCents(preview[preview.length - 1] ?? 0)}
              {preview[0] !== preview[preview.length - 1] ? ` a ${formatCents(preview[0] ?? 0)}` : ""}. A soma é exatamente o valor do contrato.
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              Gerar parcelas
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
