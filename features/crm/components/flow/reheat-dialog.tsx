"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { defineReheatAction, discardReheatAction } from "@/features/crm/actions";
import { tomorrowISO } from "@/features/crm/dates";
import { FlowDialog } from "@/features/crm/components/flow/flow-dialog";
import { NextActionFields } from "@/features/crm/components/flow/fields";
import { PROPOSAL_CHANNELS, PROPOSAL_CHANNEL_LABELS } from "@/features/crm/labels";
import { reheatSchema, type ReheatValues } from "@/features/crm/schemas";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { DealWithDetails } from "@/types";

interface ReheatDialogProps {
  deal: DealWithDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

/** Definir reaquecimento (45 dias depois da perda): nova prospecção completa ou venda direta de produto pronto. */
export function ReheatDialog({ deal, open, onOpenChange, onDone }: ReheatDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [discarding, startDiscard] = useTransition();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ReheatValues>({
    resolver: zodResolver(reheatSchema),
    defaultValues: {
      dealId: deal.id!,
      path: "nova_prospeccao",
      body: "",
      nextAction: "",
      nextActionDate: tomorrowISO(),
      nextActionTime: "09:00",
      amount: "",
      proposalChannel: "",
      documentUrl: "",
      scopeNotes: "",
    },
  });
  const path = watch("path");

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await defineReheatAction(values);
      if (result.ok) {
        toast.success(result.message);
        onDone();
      } else {
        setError(result.error);
      }
    });
  });

  function discard() {
    startDiscard(async () => {
      const result = await discardReheatAction(deal.id!);
      if (result.ok) {
        toast.success(result.message);
        onDone();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <FlowDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Definir reaquecimento."
      description={`${deal.company_name} · ${deal.title}. A comissão de um lead reaquecido é de 5%.`}
      error={error}
      pending={pending}
      submitLabel="Reaquecer lead"
      onSubmit={onSubmit}
      footerExtra={
        <Button type="button" variant="ghost" loading={discarding} onClick={discard}>
          Descartar lead
        </Button>
      }
      wide
    >
      <FormField id="reheat-path" label="Caminho">
        <NativeSelect id="reheat-path" {...register("path")}>
          <option value="nova_prospeccao">Nova prospecção — volta para Prospecção e roda o funil inteiro</option>
          <option value="venda_direta">Venda direta — produto pronto, o SDR vende sozinho (vai direto para Proposta enviada)</option>
        </NativeSelect>
      </FormField>
      <FormField id="reheat-body" label="Como o lead foi reabordado" error={errors.body?.message}>
        <Textarea id="reheat-body" rows={3} aria-invalid={!!errors.body} {...register("body")} />
      </FormField>
      {path === "venda_direta" ? (
        <div className="space-y-3">
          <p className="eyebrow">Proposta</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="reheat-amount" label="Valor (R$)" error={errors.amount?.message}>
              <Input id="reheat-amount" inputMode="decimal" placeholder="0,00" aria-invalid={!!errors.amount} {...register("amount")} />
            </FormField>
            <FormField id="reheat-channel" label="Como foi enviada" error={errors.proposalChannel?.message}>
              <NativeSelect id="reheat-channel" defaultValue="" aria-invalid={!!errors.proposalChannel} {...register("proposalChannel")}>
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
          <FormField id="reheat-url" label="Link do PDF" hint="Opcional.">
            <Input id="reheat-url" {...register("documentUrl")} />
          </FormField>
          <FormField id="reheat-scope" label="Escopo" hint="Opcional.">
            <Textarea id="reheat-scope" rows={2} {...register("scopeNotes")} />
          </FormField>
        </div>
      ) : null}
      <NextActionFields register={register} errors={errors} idPrefix="reheat" />
    </FlowDialog>
  );
}
