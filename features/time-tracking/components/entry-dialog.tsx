"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { createManualEntryAction, updateTimeEntryAction } from "@/features/time-tracking/actions";
import { dateOnlyOf, formatTime } from "@/features/time-tracking/format";
import { manualEntrySchema, type ManualEntryValues } from "@/lib/validations/time-entry";
import { todayDateOnly } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { TimeEntry } from "@/types";

type EntryDialogProps = { trigger?: ReactNode } & ({ mode: "create" } | { mode: "edit"; entry: TimeEntry });

const KIND_LABELS = { entrada: "Entrada", saida: "Saída" } as const;

function initialValues(props: EntryDialogProps): ManualEntryValues {
  if (props.mode === "edit") {
    return {
      kind: props.entry.kind,
      date: dateOnlyOf(props.entry.occurred_at),
      time: formatTime(props.entry.occurred_at),
      note: props.entry.note ?? "",
    };
  }
  return { kind: "entrada", date: todayDateOnly(), time: "", note: "" };
}

export function EntryDialog(props: EntryDialogProps) {
  const isEdit = props.mode === "edit";
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
  } = useForm<ManualEntryValues>({ resolver: zodResolver(manualEntrySchema), defaultValues: initialValues(props) });
  const kind = watch("kind");

  function handleOpenChange(next: boolean) {
    setOpen(next);
    setError(null);
    if (next) reset(initialValues(props));
  }

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = isEdit ? await updateTimeEntryAction(props.entry.id, values) : await createManualEntryAction(values);
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
        {props.trigger ?? (
          <Button variant="secondary">
            <Plus aria-hidden />
            Lançamento manual
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar lançamento." : "Lançamento manual."}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'A edição fica registrada e marcada como "Editado" no extrato.' : "Registre uma entrada ou saída esquecida."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {error ? <Alert variant="error">{error}</Alert> : null}

          <FormField id="entry-kind" label="Tipo">
            <div role="radiogroup" aria-label="Tipo" className="inline-flex w-full rounded-md border border-border-strong p-1">
              {(["entrada", "saida"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={kind === value}
                  onClick={() => setValue("kind", value, { shouldValidate: true })}
                  className={cn(
                    "flex-1 rounded px-3 py-1.5 text-sm font-semibold transition-colors",
                    kind === value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {KIND_LABELS[value]}
                </button>
              ))}
            </div>
          </FormField>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField id="entry-date" label="Data" error={errors.date?.message}>
              <Input id="entry-date" type="date" max={todayDateOnly()} {...register("date")} />
            </FormField>
            <FormField id="entry-time" label="Horário" error={errors.time?.message}>
              <Input id="entry-time" type="time" {...register("time")} />
            </FormField>
          </div>

          <FormField id="entry-note" label="Observação" error={errors.note?.message} hint="Opcional.">
            <Textarea id="entry-note" {...register("note")} />
          </FormField>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              {isEdit ? "Salvar" : "Criar lançamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
