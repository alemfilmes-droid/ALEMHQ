"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { setDirectionAction } from "@/features/crm/actions";
import { tomorrowISO } from "@/features/crm/dates";
import { DIRECTION_TASKS, DIRECTION_TASK_LABELS } from "@/features/crm/labels";
import { directionSchema, type DirectionValues } from "@/features/crm/schemas";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { DealWithDetails } from "@/types";

interface DirectionSectionProps {
  deal: DealWithDetails;
  onSaved: () => void;
}

/** Só head/diretoria/master: observações + próxima ação do SDR. Devolve a bola ao SDR e avisa. */
export function DirectionSection({ deal, onSaved }: DirectionSectionProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DirectionValues>({
    resolver: zodResolver(directionSchema),
    defaultValues: { dealId: deal.id!, task: undefined as never, note: "", dueDate: tomorrowISO(), dueTime: "09:00" },
  });

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await setDirectionAction(values);
      if (result.ok) {
        toast.success(result.message);
        reset({ dealId: deal.id!, task: undefined as never, note: "", dueDate: tomorrowISO(), dueTime: "09:00" });
        onSaved();
      } else {
        setError(result.error);
      }
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4">
      {deal.direction_task ? (
        <Alert variant="info">
          Último direcionamento: {DIRECTION_TASK_LABELS[deal.direction_task]}
          {deal.direction_note ? ` — ${deal.direction_note}` : ""}
        </Alert>
      ) : null}
      {error ? <Alert variant="error">{error}</Alert> : null}
      <FormField id="direction-task" label="Próxima ação para o SDR" error={errors.task?.message}>
        <NativeSelect id="direction-task" defaultValue="" aria-invalid={!!errors.task} {...register("task")}>
          <option value="" disabled>
            Selecione
          </option>
          {DIRECTION_TASKS.map((task) => (
            <option key={task} value={task}>
              {DIRECTION_TASK_LABELS[task]}
            </option>
          ))}
        </NativeSelect>
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="direction-date" label="Até quando" error={errors.dueDate?.message}>
          <Input id="direction-date" type="date" {...register("dueDate")} />
        </FormField>
        <FormField id="direction-time" label="Horário">
          <Input id="direction-time" type="time" {...register("dueTime")} />
        </FormField>
      </div>
      <FormField id="direction-note" label="Observações" hint="Opcional." error={errors.note?.message}>
        <Textarea id="direction-note" rows={3} {...register("note")} />
      </FormField>
      <Button type="submit" size="sm" loading={pending}>
        Salvar direcionamento
      </Button>
    </form>
  );
}
