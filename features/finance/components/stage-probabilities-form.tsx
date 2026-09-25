"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { saveStageProbabilityAction } from "@/features/crm/actions";
import { DEAL_STAGES, DEAL_STAGE_LABELS } from "@/features/crm/labels";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import type { DealStage } from "@/types";

type Values = Record<DealStage, string>;

/** Probabilidade de fechamento por etapa (diretoria/master editam). Base da previsão ponderada. */
export function StageProbabilitiesForm({ probabilities }: { probabilities: { stage: DealStage; probability: number }[] }) {
  const [pending, startTransition] = useTransition();
  const initial = Object.fromEntries(
    DEAL_STAGES.map((stage) => [stage, String(Math.round((probabilities.find((item) => item.stage === stage)?.probability ?? 0) * 100))]),
  ) as Values;
  const {
    register,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<Values>({ defaultValues: initial });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      for (const stage of DEAL_STAGES) {
        if (values[stage] === initial[stage]) continue;
        const result = await saveStageProbabilityAction({ stage, probability: values[stage] });
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
      }
      toast.success("Probabilidades atualizadas.");
      reset(values);
    });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Probabilidade por etapa</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {DEAL_STAGES.map((stage) => (
              <FormField key={stage} id={`prob-${stage}`} label={`${DEAL_STAGE_LABELS[stage]} (%)`}>
                <Input id={`prob-${stage}`} inputMode="decimal" {...register(stage)} />
              </FormField>
            ))}
          </div>
          <Button type="submit" size="sm" variant="secondary" loading={pending} disabled={!isDirty}>
            Salvar probabilidades
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
