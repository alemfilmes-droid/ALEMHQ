"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { registerMeetingOutcomeAction } from "@/features/crm/actions";
import { tomorrowISO } from "@/features/crm/dates";
import { FlowDialog } from "@/features/crm/components/flow/flow-dialog";
import { NextActionFields } from "@/features/crm/components/flow/fields";
import { MEETING_OUTCOMES, MEETING_OUTCOME_HINTS, MEETING_OUTCOME_LABELS } from "@/features/crm/labels";
import { outcomeSchema, type OutcomeValues } from "@/features/crm/schemas";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import type { MeetingOutcome } from "@/types";

interface MeetingOutcomeDialogProps {
  meeting: { id: string; dealTitle: string; scheduledAt: string | null };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (result: MeetingOutcome) => void;
}

/** O atendente PRECISA registrar o resultado antes de o negócio andar — e o resultado decide para onde ele vai. */
export function MeetingOutcomeDialog({ meeting, open, onOpenChange, onDone }: MeetingOutcomeDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<OutcomeValues>({
    resolver: zodResolver(outcomeSchema),
    defaultValues: {
      meetingId: meeting.id,
      result: undefined as never,
      note: "",
      nextAction: "",
      nextActionDate: tomorrowISO(),
      nextActionTime: "09:00",
      newDate: "",
      newTime: "10:00",
      newDuration: "",
      newLocation: "",
    },
  });
  const result = watch("result");

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const response = await registerMeetingOutcomeAction(values);
      if (response.ok) {
        toast.success(response.message);
        onDone(values.result);
      } else {
        setError(response.error);
      }
    });
  });

  return (
    <FlowDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Resultado da reunião."
      description={`${meeting.dealTitle}${meeting.scheduledAt ? ` · ${formatDateTime(meeting.scheduledAt)}` : ""}. O negócio só avança depois deste registro.`}
      error={error}
      pending={pending}
      submitLabel="Registrar resultado"
      onSubmit={onSubmit}
      wide
    >
      <FormField id="outcome-result" label="Resultado" hint={result ? MEETING_OUTCOME_HINTS[result] : undefined} error={errors.result?.message}>
        <NativeSelect id="outcome-result" defaultValue="" aria-invalid={!!errors.result} {...register("result")}>
          <option value="" disabled>
            Selecione o resultado
          </option>
          {MEETING_OUTCOMES.map((item) => (
            <option key={item} value={item}>
              {MEETING_OUTCOME_LABELS[item]}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <FormField id="outcome-note" label="O que aconteceu na reunião" hint="Obrigatório. Vai para a linha do tempo e para quem receber o negócio." error={errors.note?.message}>
        <Textarea id="outcome-note" rows={4} aria-invalid={!!errors.note} {...register("note")} />
      </FormField>

      {result === "remarcar" ? (
        <div className="space-y-3">
          <p className="eyebrow">Nova reunião</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="outcome-new-date" label="Nova data" error={errors.newDate?.message}>
              <Input id="outcome-new-date" type="date" aria-invalid={!!errors.newDate} {...register("newDate")} />
            </FormField>
            <FormField id="outcome-new-time" label="Horário">
              <Input id="outcome-new-time" type="time" {...register("newTime")} />
            </FormField>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="outcome-new-duration" label="Duração (min)" hint="Vazio = mesma da anterior.">
              <Input id="outcome-new-duration" inputMode="numeric" {...register("newDuration")} />
            </FormField>
            <FormField id="outcome-new-location" label="Link ou endereço" hint="Vazio = o mesmo.">
              <Input id="outcome-new-location" {...register("newLocation")} />
            </FormField>
          </div>
        </div>
      ) : result && result !== "fechado_na_call" ? (
        <NextActionFields register={register} errors={errors} idPrefix="outcome" optional />
      ) : null}
    </FlowDialog>
  );
}
