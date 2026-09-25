"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { getDealDetailAction, logClientResponseAction } from "@/features/crm/actions";
import { tomorrowISO } from "@/features/crm/dates";
import { FlowDialog } from "@/features/crm/components/flow/flow-dialog";
import { InteractionFields, NextActionFields } from "@/features/crm/components/flow/fields";
import { DEAL_STAGE_LABELS, INTERACTION_CHANNEL_LABELS, suggestedStageAfterResponse } from "@/features/crm/labels";
import { clientResponseSchema, type ClientResponseValues } from "@/features/crm/schemas";
import type { DealInteractionDetail } from "@/features/crm/types";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { formatDateTime } from "@/lib/format";
import type { DealStage, DealWithDetails } from "@/types";

interface ClientRespondedDialogProps {
  deal: DealWithDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (advanceTo: DealStage | null) => void;
}

/** "Cliente respondeu": registra a resposta, liga à tentativa que ela responde e sugere avançar a etapa. */
export function ClientRespondedDialog({ deal, open, onOpenChange, onDone }: ClientRespondedDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<DealInteractionDetail[]>([]);
  const [advance, setAdvance] = useState(true);
  const [pending, startTransition] = useTransition();
  const suggested = suggestedStageAfterResponse(deal.stage!);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ClientResponseValues>({
    resolver: zodResolver(clientResponseSchema),
    defaultValues: {
      dealId: deal.id!,
      channel: undefined as never,
      approach: "",
      body: "",
      respondedToId: "",
      nextAction: "",
      nextActionDate: tomorrowISO(),
      nextActionTime: "09:00",
    },
  });

  useEffect(() => {
    let active = true;
    getDealDetailAction(deal.id!).then((detail) => {
      if (active && detail) setAttempts(detail.interactions.filter((item) => item.kind === "tentativa_contato").slice(0, 10));
    });
    return () => {
      active = false;
    };
  }, [deal.id]);

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await logClientResponseAction(values);
      if (result.ok) {
        toast.success(result.message);
        onDone(suggested && advance ? suggested : null);
      } else {
        setError(result.error);
      }
    });
  });

  return (
    <FlowDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Cliente respondeu."
      description={`${deal.company_name} · ${deal.title}.`}
      error={error}
      pending={pending}
      submitLabel="Registrar resposta"
      onSubmit={onSubmit}
      wide
    >
      <FormField id="resp-attempt" label="Qual tentativa ele respondeu" hint="Opcional, mas ajuda a saber o que funcionou.">
        <NativeSelect id="resp-attempt" defaultValue="" {...register("respondedToId")}>
          <option value="">Não sei / outra</option>
          {attempts.map((attempt) => (
            <option key={attempt.id} value={attempt.id}>
              {formatDateTime(attempt.occurred_at)} · {attempt.channel ? INTERACTION_CHANNEL_LABELS[attempt.channel] : "—"}
              {attempt.approach ? ` · ${attempt.approach}` : ""}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <InteractionFields register={register} errors={errors} idPrefix="resp" requireApproach={false} bodyLabel="O que o cliente respondeu" />
      <NextActionFields register={register} errors={errors} idPrefix="resp" />
      {suggested ? (
        <div className="flex items-center gap-2">
          <Checkbox id="resp-advance" checked={advance} onCheckedChange={(checked) => setAdvance(checked === true)} />
          <Label htmlFor="resp-advance" className="cursor-pointer font-normal">
            Avançar para {DEAL_STAGE_LABELS[suggested]} em seguida
          </Label>
        </div>
      ) : null}
    </FlowDialog>
  );
}
