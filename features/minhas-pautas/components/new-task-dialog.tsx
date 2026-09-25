"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createStandaloneTaskAction } from "@/features/minhas-pautas/actions";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusDot } from "@/components/ui/status-dot";
import { Textarea } from "@/components/ui/textarea";
import { SQUAD_LABELS } from "@/lib/auth/squads";
import { SQUAD_TONE } from "@/lib/status";
import type { Squad } from "@/types";
import { PRIORITIES, PRIORITY_LABELS } from "@/lib/domain";
import { createStandaloneTaskSchema, type CreateStandaloneTaskValues } from "@/lib/validations/pauta";

const EMPTY: CreateStandaloneTaskValues = { title: "", description: "", dueDate: "", priority: "media", squad: "" };

/** `squads`: os squads da pessoa — com mais de um, ela escolhe a qual squad a tarefa pertence. */
export function NewTaskDialog({ squads = [] }: { squads?: Squad[] }) {
  const empty: CreateStandaloneTaskValues = { ...EMPTY, squad: squads.length > 1 ? (squads[0] ?? "") : "" };
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateStandaloneTaskValues>({ resolver: zodResolver(createStandaloneTaskSchema), defaultValues: empty });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      reset(empty);
      setError(null);
    }
  }

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await createStandaloneTaskAction(values);
      if (!result.ok) return setError(result.error);
      toast.success(result.message);
      handleOpenChange(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Plus aria-hidden />
          Nova tarefa
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova tarefa.</DialogTitle>
          <DialogDescription>Uma tarefa avulsa é pessoal — sem cliente nem projeto, só aparece no seu quadro.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {error ? <Alert variant="error">{error}</Alert> : null}

          <FormField id="task-new-title" label="Título" error={errors.title?.message}>
            <Input id="task-new-title" aria-invalid={!!errors.title} {...register("title")} />
          </FormField>

          <FormField id="task-new-description" label="Descrição" hint="Opcional." error={errors.description?.message}>
            <Textarea id="task-new-description" {...register("description")} />
          </FormField>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField id="task-new-due" label="Prazo" hint="Opcional." error={errors.dueDate?.message}>
              <Input id="task-new-due" type="date" {...register("dueDate")} />
            </FormField>
            <FormField id="task-new-priority" label="Prioridade">
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="task-new-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((item) => (
                        <SelectItem key={item} value={item}>
                          {PRIORITY_LABELS[item]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          </div>

          {squads.length > 1 ? (
            <FormField id="task-new-squad" label="Squad" hint="Define a cor e o agrupamento no seu quadro.">
              <Controller
                control={control}
                name="squad"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="task-new-squad">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {squads.map((squad) => (
                        <SelectItem key={squad} value={squad}>
                          <span className="flex items-center gap-2">
                            <StatusDot tone={SQUAD_TONE[squad]} />
                            {SQUAD_LABELS[squad]}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          ) : null}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              Criar tarefa
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
