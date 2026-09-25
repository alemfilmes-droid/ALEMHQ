"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { changeDealStageAction } from "@/features/crm/actions";
import { tomorrowISO } from "@/features/crm/dates";
import { FlowDialog } from "@/features/crm/components/flow/flow-dialog";
import { InteractionFields, NextActionFields } from "@/features/crm/components/flow/fields";
import { DEAL_STAGE_LABELS } from "@/features/crm/labels";
import { stageChangeSchema, type StageChangeValues } from "@/features/crm/schemas";
import type { DealStage, DealWithDetails } from "@/types";

interface StageChangeDialogProps {
  deal: DealWithDetails;
  stage: DealStage;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

function kindFor(stage: DealStage): StageChangeValues["kind"] {
  return stage === "prospeccao" || stage === "primeiro_contato" || stage === "tentativas_contato" ? "tentativa_contato" : "nota";
}

/** Mudança de etapa comum: exige registrar o contato (canal, abordagem, conteúdo) e a próxima ação. */
export function StageChangeDialog({ deal, stage, open, onOpenChange, onDone }: StageChangeDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<StageChangeValues>({
    resolver: zodResolver(stageChangeSchema),
    defaultValues: {
      dealId: deal.id!,
      stage,
      kind: kindFor(stage),
      channel: undefined as never,
      approach: "",
      body: "",
      nextAction: "",
      nextActionDate: tomorrowISO(),
      nextActionTime: "09:00",
    },
  });

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await changeDealStageAction(values);
      if (result.ok) {
        toast.success(`Negócio movido para ${DEAL_STAGE_LABELS[stage]}.`);
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
      title={`Mover para ${DEAL_STAGE_LABELS[stage]}.`}
      description="Toda mudança de etapa exige registrar o contato realizado e a próxima ação."
      error={error}
      pending={pending}
      submitLabel="Registrar e mover"
      onSubmit={onSubmit}
      wide
    >
      <InteractionFields register={register} errors={errors} idPrefix="stage" />
      <NextActionFields register={register} errors={errors} idPrefix="stage" />
    </FlowDialog>
  );
}
