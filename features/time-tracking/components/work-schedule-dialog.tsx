"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { updateWorkScheduleAction } from "@/features/time-tracking/actions";
import { workScheduleFormSchema, type WorkScheduleFormValues } from "@/lib/validations/time-entry";
import { formatDate, todayDateOnly } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { WorkSchedule } from "@/types";

const WEEKDAYS = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
  { value: 7, label: "Dom" },
];

interface WorkScheduleDialogProps {
  profileId: string;
  fullName: string;
  schedule: WorkSchedule | null;
  /** Usada como referência quando "Início da contagem" fica em branco (a view cai para essa data). */
  profileCreatedAt: string;
}

function defaults(schedule: WorkSchedule | null): WorkScheduleFormValues {
  return {
    dailyHours: String(schedule?.daily_hours ?? 8),
    workdays: schedule?.workdays ?? [1, 2, 3, 4, 5],
    effectiveFrom: schedule?.effective_from ?? "",
  };
}

export function WorkScheduleDialog({ profileId, fullName, schedule, profileCreatedAt }: WorkScheduleDialogProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<WorkScheduleFormValues>({ resolver: zodResolver(workScheduleFormSchema), defaultValues: defaults(schedule) });
  const workdays = watch("workdays");
  const effectiveFrom = watch("effectiveFrom");

  function handleOpenChange(next: boolean) {
    setOpen(next);
    setError(null);
    if (next) reset(defaults(schedule));
  }

  function toggleDay(day: number) {
    const next = workdays.includes(day) ? workdays.filter((d) => d !== day) : [...workdays, day].sort((a, b) => a - b);
    setValue("workdays", next, { shouldValidate: true });
  }

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await updateWorkScheduleAction(profileId, {
        dailyHours: Number(values.dailyHours.replace(",", ".")),
        workdays: values.workdays,
        effectiveFrom: values.effectiveFrom || null,
      });
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
      } else {
        setError(result.error);
      }
    });
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Editar carga horária de ${fullName}`}>
          <Settings2 className="size-4" aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Carga horária.</DialogTitle>
          <DialogDescription>{fullName}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {error ? <Alert variant="error">{error}</Alert> : null}

          <FormField id="schedule-hours" label="Horas por dia" error={errors.dailyHours?.message}>
            <Input id="schedule-hours" inputMode="decimal" placeholder="8" {...register("dailyHours")} />
          </FormField>

          <FormField id="schedule-days" label="Dias de trabalho" error={errors.workdays?.message}>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Dias de trabalho">
              {WEEKDAYS.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  aria-pressed={workdays.includes(day.value)}
                  onClick={() => toggleDay(day.value)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm font-semibold transition-colors",
                    workdays.includes(day.value)
                      ? "border-foreground bg-foreground text-background"
                      : "border-border-strong text-muted-foreground hover:text-foreground",
                  )}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </FormField>

          <FormField
            id="schedule-effective-from"
            label="Início da contagem"
            error={errors.effectiveFrom?.message}
            hint={`Opcional. Em branco, conta a partir de quando a pessoa entrou (${formatDate(profileCreatedAt)}).`}
          >
            <div className="flex gap-2">
              <Input id="schedule-effective-from" type="date" max={todayDateOnly()} {...register("effectiveFrom")} />
              {effectiveFrom ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setValue("effectiveFrom", "", { shouldValidate: true })}>
                  Limpar
                </Button>
              ) : null}
            </div>
          </FormField>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
