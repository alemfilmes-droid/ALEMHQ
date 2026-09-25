"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { markDealLostAction } from "@/features/crm/actions";
import { FlowDialog } from "@/features/crm/components/flow/flow-dialog";
import { DEAL_LOSS_REASONS, DEAL_LOSS_REASON_LABELS } from "@/features/crm/labels";
import { lossSchema, type LossValues } from "@/features/crm/schemas";
import { FormField } from "@/components/ui/form-field";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { DealWithDetails } from "@/types";

interface LossDialogProps {
  deal: DealWithDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

/** Marcar como perdido sempre exige motivo — e o negócio fica sem responsável até o reaquecimento (45 dias). */
export function LossDialog({ deal, open, onOpenChange, onDone }: LossDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LossValues>({ resolver: zodResolver(lossSchema), defaultValues: { dealId: deal.id!, reason: undefined as never, note: "" } });

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await markDealLostAction(values);
      if (result.ok) {
        toast.success(result.message);
        onDone();
      } else {
        setError(result.error);
      }
    });
  });

  return (
    <FlowDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Marcar como perdido."
      description="O negócio fica sem responsável. Em 45 dias o SDR é avisado para decidir o reaquecimento."
      error={error}
      pending={pending}
      submitLabel="Marcar como perdido"
      onSubmit={onSubmit}
    >
      <FormField id="loss-reason" label="Motivo da perda" error={errors.reason?.message}>
        <NativeSelect id="loss-reason" defaultValue="" aria-invalid={!!errors.reason} {...register("reason")}>
          <option value="" disabled>
            Selecione o motivo
          </option>
          {DEAL_LOSS_REASONS.map((reason) => (
            <option key={reason} value={reason}>
              {DEAL_LOSS_REASON_LABELS[reason]}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField id="loss-note" label="O que aconteceu" hint="Fica registrado na linha do tempo." error={errors.note?.message}>
        <Textarea id="loss-note" rows={3} {...register("note")} />
      </FormField>
    </FlowDialog>
  );
}
