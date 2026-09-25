"use client";

import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { saveQualificationAction } from "@/features/crm/actions";
import { qualificationSchema, type QualificationValues } from "@/features/crm/schemas";
import type { DealQualificationDetail } from "@/features/crm/types";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

function toFormValues(qualification: DealQualificationDetail | null): QualificationValues {
  return {
    budgetRange: qualification?.budget_range ?? "",
    projectType: qualification?.project_type ?? "",
    desiredTimeline: qualification?.desired_timeline ?? "",
    decisionMakerContacted: qualification?.decision_maker_contacted ?? false,
    painPoint: qualification?.pain_point ?? "",
    notes: qualification?.notes ?? "",
  };
}

interface QualificationFormProps {
  dealId: string;
  qualification: DealQualificationDetail | null;
  submitLabel?: string;
  onSaved?: () => void;
}

/** Checklist de qualificação — os 4 primeiros campos são exigidos pelo banco para avançar do funil. */
export function QualificationForm({ dealId, qualification, submitLabel = "Salvar qualificação", onSaved }: QualificationFormProps) {
  const [pending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    formState: { isDirty },
  } = useForm<QualificationValues>({ resolver: zodResolver(qualificationSchema), defaultValues: toFormValues(qualification) });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = await saveQualificationAction(dealId, values);
      if (result.ok) {
        toast.success(result.message);
        onSaved?.();
      } else {
        toast.error(result.error);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="qual-budget" label="Faixa de orçamento">
          <Input id="qual-budget" placeholder="Ex.: R$ 15 mil a R$ 25 mil" {...register("budgetRange")} />
        </FormField>
        <FormField id="qual-type" label="Tipo de projeto">
          <Input id="qual-type" placeholder="Ex.: campanha institucional" {...register("projectType")} />
        </FormField>
        <FormField id="qual-timeline" label="Prazo desejado">
          <Input id="qual-timeline" placeholder="Ex.: em até 60 dias" {...register("desiredTimeline")} />
        </FormField>
        <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-3">
          <Label htmlFor="qual-decision-maker" className="cursor-pointer">
            Decisor foi contatado
          </Label>
          <Controller
            control={control}
            name="decisionMakerContacted"
            render={({ field }) => <Switch id="qual-decision-maker" checked={field.value} onCheckedChange={field.onChange} />}
          />
        </div>
      </div>

      <FormField id="qual-pain" label="Dor do cliente" hint="Opcional.">
        <Textarea id="qual-pain" {...register("painPoint")} />
      </FormField>

      <FormField id="qual-notes" label="Notas" hint="Opcional.">
        <Textarea id="qual-notes" {...register("notes")} />
      </FormField>

      <Button type="submit" loading={pending} disabled={!isDirty}>
        {submitLabel}
      </Button>
    </form>
  );
}
