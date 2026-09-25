"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { updatePautaAction } from "@/features/pautas/actions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { PRIORITIES, PRIORITY_LABELS } from "@/lib/domain";
import type { PautaWithDetails, ProjectPriority } from "@/types";

interface FormValues {
  title: string;
  description: string;
  dueDate: string;
}

interface StandaloneTaskDetailsTabProps {
  pauta: PautaWithDetails;
  onChanged: (pauta: PautaWithDetails) => void;
}

/** Tarefa avulsa: sem cliente, projeto ou responsáveis — só título, descrição, prazo e prioridade. */
export function StandaloneTaskDetailsTab({ pauta, onChanged }: StandaloneTaskDetailsTabProps) {
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<FormValues>({
    defaultValues: { title: pauta.title ?? "", description: pauta.briefing ?? "", dueDate: pauta.due_date ?? "" },
  });

  function setPriority(priority: ProjectPriority) {
    startTransition(async () => {
      const result = await updatePautaAction(pauta.id!, { priority });
      if (result.ok) {
        toast.success("Prioridade atualizada.");
        onChanged({ ...pauta, priority });
      } else {
        toast.error(result.error);
      }
    });
  }

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = await updatePautaAction(pauta.id!, {
        title: values.title,
        briefing: values.description || null,
        dueDate: values.dueDate || null,
      });
      if (result.ok) {
        toast.success("Salvo.");
        reset(values);
        onChanged({ ...pauta, title: values.title, briefing: values.description || null, due_date: values.dueDate || null });
      } else {
        toast.error(result.error);
      }
    });
  });

  return (
    <div className="space-y-6">
      <FormField id="task-priority" label="Prioridade">
        <Select value={pauta.priority ?? undefined} disabled={pending} onValueChange={(value) => setPriority(value as ProjectPriority)}>
          <SelectTrigger id="task-priority">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRIORITIES.map((priority) => (
              <SelectItem key={priority} value={priority}>
                {PRIORITY_LABELS[priority]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormField>

      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <FormField id="task-title" label="Título">
          <Input id="task-title" {...register("title")} />
        </FormField>

        <FormField id="task-due" label="Prazo" hint="Opcional.">
          <Input id="task-due" type="date" {...register("dueDate")} />
        </FormField>

        <FormField id="task-description" label="Descrição" hint="Opcional.">
          <Textarea id="task-description" rows={5} {...register("description")} />
        </FormField>

        <Button type="submit" loading={pending} disabled={!isDirty}>
          Salvar alterações
        </Button>
      </form>

      <p className="text-xs text-subtle">Criada em {formatDateTime(pauta.created_at!)}.</p>
    </div>
  );
}
