"use client";

import { Money } from "@/components/ui/money";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { getDealDetailAction, registerNegotiationAction } from "@/features/crm/actions";
import { tomorrowISO } from "@/features/crm/dates";
import { FlowDialog } from "@/features/crm/components/flow/flow-dialog";
import { NextActionFields } from "@/features/crm/components/flow/fields";
import { INTERACTION_CHANNELS, INTERACTION_CHANNEL_LABELS } from "@/features/crm/labels";
import { negotiationSchema, type NegotiationValues } from "@/features/crm/schemas";
import { toCents } from "@/features/finance/money";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { DealProposal, DealWithDetails } from "@/types";

interface NegotiationDialogProps {
  deal: DealWithDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  /** Abre "Cliente respondeu" — a regra exige a resposta do cliente antes de negociar. */
  onNeedsResponse: () => void;
}

/** Negociação: só entra depois que o cliente respondeu à proposta. Guarda contraproposta, nossa resposta e o valor acordado. */
export function NegotiationDialog({ deal, open, onOpenChange, onDone, onNeedsResponse }: NegotiationDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<DealProposal | null>(null);
  const [responded, setResponded] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<NegotiationValues>({
    resolver: zodResolver(negotiationSchema),
    defaultValues: {
      dealId: deal.id!,
      proposalId: "",
      clientCounterAmount: "",
      ourCounterAmount: "",
      agreedAmount: "",
      channel: undefined as never,
      notes: "",
      nextAction: "",
      nextActionDate: tomorrowISO(),
      nextActionTime: "09:00",
    },
  });

  useEffect(() => {
    let active = true;
    getDealDetailAction(deal.id!).then((detail) => {
      if (!active || !detail) return;
      const latest = detail.proposals[0] ?? null;
      setProposal(latest);
      if (latest) setValue("proposalId", latest.id);
      setResponded(
        latest !== null &&
          detail.interactions.some((item) => item.kind === "resposta_cliente" && new Date(item.occurred_at).getTime() > new Date(latest.sent_at).getTime()),
      );
    });
    return () => {
      active = false;
    };
  }, [deal.id, setValue]);

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await registerNegotiationAction(values);
      if (result.ok) {
        toast.success(result.message);
        onDone();
      } else {
        setError(result.error);
      }
    });
  });

  const blocked = responded === false || (responded === null ? false : proposal === null);

  return (
    <FlowDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Negociação."
      description={`${deal.company_name} · ${deal.title}. Regra: o negócio só entra em negociação depois que o cliente responder à proposta.`}
      error={error}
      pending={pending}
      submitLabel="Registrar negociação"
      onSubmit={onSubmit}
      footerExtra={
        blocked ? (
          <Button type="button" variant="secondary" onClick={onNeedsResponse}>
            Registrar resposta do cliente
          </Button>
        ) : null
      }
      wide
    >
      {responded === null ? (
        <Skeleton className="h-16 w-full" />
      ) : proposal === null ? (
        <Alert variant="info">Este negócio ainda não tem proposta registrada. Registre a proposta primeiro.</Alert>
      ) : (
        <Alert variant={responded ? "success" : "info"}>
          Proposta de <Money cents={toCents(proposal.amount)} />.{" "}
          {responded ? "O cliente já respondeu — pode registrar a negociação." : "O cliente ainda não respondeu: registre a resposta dele antes de negociar."}
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField id="neg-client" label="Contraproposta do cliente (R$)" error={errors.clientCounterAmount?.message}>
          <Input id="neg-client" inputMode="decimal" placeholder="0,00" {...register("clientCounterAmount")} />
        </FormField>
        <FormField id="neg-ours" label="Nossa contraproposta (R$)" error={errors.ourCounterAmount?.message}>
          <Input id="neg-ours" inputMode="decimal" placeholder="0,00" {...register("ourCounterAmount")} />
        </FormField>
        <FormField id="neg-agreed" label="Valor acordado (R$)" hint="Se já houver." error={errors.agreedAmount?.message}>
          <Input id="neg-agreed" inputMode="decimal" placeholder="0,00" {...register("agreedAmount")} />
        </FormField>
      </div>
      <FormField id="neg-channel" label="Canal" error={errors.channel?.message}>
        <NativeSelect id="neg-channel" defaultValue="" aria-invalid={!!errors.channel} {...register("channel")}>
          <option value="" disabled>
            Selecione o canal
          </option>
          {INTERACTION_CHANNELS.map((channel) => (
            <option key={channel} value={channel}>
              {INTERACTION_CHANNEL_LABELS[channel]}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField id="neg-notes" label="O que foi conversado" error={errors.notes?.message}>
        <Textarea id="neg-notes" rows={3} aria-invalid={!!errors.notes} {...register("notes")} />
      </FormField>
      <NextActionFields register={register} errors={errors} idPrefix="neg" />
    </FlowDialog>
  );
}
