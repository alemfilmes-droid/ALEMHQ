"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { registerProposalAction } from "@/features/crm/actions";
import { tomorrowISO } from "@/features/crm/dates";
import { FlowDialog } from "@/features/crm/components/flow/flow-dialog";
import { NextActionFields } from "@/features/crm/components/flow/fields";
import { PROPOSAL_CHANNELS, PROPOSAL_CHANNEL_LABELS } from "@/features/crm/labels";
import { proposalSchema, type ProposalValues } from "@/features/crm/schemas";
import { centsToInput, toCents } from "@/features/finance/money";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { DealWithDetails } from "@/types";

interface ProposalDialogProps {
  deal: DealWithDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  onNeedsQualification: () => void;
}

/** Registra a proposta (uma nova linha por revisão). O valor do negócio passa a acompanhar a proposta mais recente. */
export function ProposalDialog({ deal, open, onOpenChange, onDone, onNeedsQualification }: ProposalDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProposalValues>({
    resolver: zodResolver(proposalSchema),
    defaultValues: {
      dealId: deal.id!,
      amount: deal.estimated_value != null ? centsToInput(toCents(deal.estimated_value)) : "",
      channel: undefined as never,
      documentUrl: "",
      scopeNotes: "",
      nextAction: "Follow-up da proposta",
      nextActionDate: tomorrowISO(),
      nextActionTime: "09:00",
    },
  });

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await registerProposalAction(values);
      if (result.ok) {
        toast.success(result.message);
        onDone();
      } else if (result.needs === "qualification") {
        onNeedsQualification();
      } else {
        setError(result.error);
      }
    });
  });

  return (
    <FlowDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Registrar proposta."
      description={`${deal.company_name} · ${deal.title}. O negócio passa para Proposta enviada e o valor entra em "Em negociação".`}
      error={error}
      pending={pending}
      submitLabel="Registrar proposta"
      onSubmit={onSubmit}
      wide
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="proposal-amount" label="Valor da proposta (R$)" error={errors.amount?.message}>
          <Input id="proposal-amount" inputMode="decimal" placeholder="0,00" aria-invalid={!!errors.amount} {...register("amount")} />
        </FormField>
        <FormField id="proposal-channel" label="Como foi enviada" error={errors.channel?.message}>
          <NativeSelect id="proposal-channel" defaultValue="" aria-invalid={!!errors.channel} {...register("channel")}>
            <option value="" disabled>
              Selecione
            </option>
            {PROPOSAL_CHANNELS.map((channel) => (
              <option key={channel} value={channel}>
                {PROPOSAL_CHANNEL_LABELS[channel]}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      </div>
      <FormField id="proposal-url" label="Link do PDF" hint="Opcional." error={errors.documentUrl?.message}>
        <Input id="proposal-url" placeholder="https://drive.google.com/…" {...register("documentUrl")} />
      </FormField>
      <FormField id="proposal-scope" label="Escopo e observações" hint="Opcional." error={errors.scopeNotes?.message}>
        <Textarea id="proposal-scope" rows={3} {...register("scopeNotes")} />
      </FormField>
      <NextActionFields register={register} errors={errors} idPrefix="proposal" />
    </FlowDialog>
  );
}
