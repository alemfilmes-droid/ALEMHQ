"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { scheduleDealMeetingAction } from "@/features/crm/actions";
import { tomorrowISO } from "@/features/crm/dates";
import { FlowDialog } from "@/features/crm/components/flow/flow-dialog";
import { meetingSchema, type MeetingValues } from "@/features/crm/schemas";
import type { DealFormOptions } from "@/features/crm/types";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { DealWithDetails } from "@/types";

interface ScheduleMeetingDialogProps {
  deal: DealWithDetails;
  options: DealFormOptions;
  currentUserId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
  /** Quando o banco recusa por falta de qualificação, oferece qualificar ali mesmo. */
  onNeedsQualification: () => void;
}

/** Agenda a reunião: cria o compromisso na agenda de quem atende, move o negócio e avisa com o resumo da qualificação. */
export function ScheduleMeetingDialog({ deal, options, currentUserId, open, onOpenChange, onDone, onNeedsQualification }: ScheduleMeetingDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MeetingValues>({
    resolver: zodResolver(meetingSchema),
    defaultValues: {
      dealId: deal.id!,
      scheduledDate: tomorrowISO(),
      scheduledTime: "10:00",
      durationMinutes: "60",
      attendeeId: deal.responsible_id && deal.responsible_id !== deal.owner_id ? deal.responsible_id : currentUserId,
      locationOrLink: "",
    },
  });

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await scheduleDealMeetingAction(values);
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
      title="Agendar reunião."
      description="Entra na agenda de quem vai atender e o negócio passa para Reunião agendada, com essa pessoa como responsável."
      error={error}
      pending={pending}
      submitLabel="Agendar"
      onSubmit={onSubmit}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="meeting-date" label="Data" error={errors.scheduledDate?.message}>
          <Input id="meeting-date" type="date" {...register("scheduledDate")} />
        </FormField>
        <FormField id="meeting-time" label="Horário" error={errors.scheduledTime?.message}>
          <Input id="meeting-time" type="time" {...register("scheduledTime")} />
        </FormField>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="meeting-duration" label="Duração (minutos)" error={errors.durationMinutes?.message}>
          <Input id="meeting-duration" inputMode="numeric" {...register("durationMinutes")} />
        </FormField>
        <FormField id="meeting-attendee" label="Quem vai atender" error={errors.attendeeId?.message}>
          <NativeSelect id="meeting-attendee" {...register("attendeeId")}>
            {options.members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.full_name}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      </div>
      <FormField id="meeting-location" label="Link ou endereço" hint="Opcional." error={errors.locationOrLink?.message}>
        <Input id="meeting-location" placeholder="https://meet.google.com/… ou endereço" {...register("locationOrLink")} />
      </FormField>
    </FlowDialog>
  );
}
