"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { updateDealAction } from "@/features/crm/actions";
import { splitTimestamp } from "@/features/crm/dates";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import type { DealWithDetails } from "@/types";

interface NextActionCardProps {
  deal: DealWithDetails;
  onSaved: () => void;
}

/** Sempre em destaque: o negócio aberto nunca fica sem próxima ação e data. */
export function NextActionCard({ deal, onSaved }: NextActionCardProps) {
  const [pending, startTransition] = useTransition();
  const initial = splitTimestamp(deal.next_action_at);
  const {
    register,
    handleSubmit,
    reset,
    formState: { isDirty, errors },
  } = useForm<{ nextAction: string; nextActionDate: string; nextActionTime: string }>({
    defaultValues: { nextAction: deal.next_action ?? "", nextActionDate: initial.date, nextActionTime: initial.time },
  });

  const onSubmit = handleSubmit((values) => {
    if (values.nextAction.trim().length < 2 || !values.nextActionDate) {
      toast.error("Informe a próxima ação e a data.");
      return;
    }
    startTransition(async () => {
      const result = await updateDealAction(deal.id!, {
        nextAction: values.nextAction,
        nextActionDate: values.nextActionDate,
        nextActionTime: values.nextActionTime,
      });
      if (result.ok) {
        toast.success("Próxima ação salva.");
        reset(values);
        onSaved();
      } else {
        toast.error(result.error);
      }
    });
  });

  return (
    <section aria-labelledby="proxima-acao-title" className={`space-y-3 rounded-md border p-4 ${deal.next_action_overdue ? "border-2 border-foreground" : "border-border"}`}>
      <h3 id="proxima-acao-title" className="section-title">
        Próxima ação
      </h3>
      <form onSubmit={onSubmit} noValidate className="flex flex-wrap items-end gap-3">
        <FormField id="next-action" label="O que fazer" className="min-w-48 flex-1" error={errors.nextAction?.message}>
          <Input id="next-action" placeholder="Ex.: ligar para confirmar a proposta" {...register("nextAction")} />
        </FormField>
        <FormField id="next-action-date" label="Quando">
          <Input id="next-action-date" type="date" className="w-40" {...register("nextActionDate")} />
        </FormField>
        <FormField id="next-action-time" label="Horário">
          <Input id="next-action-time" type="time" className="w-28" {...register("nextActionTime")} />
        </FormField>
        <Button type="submit" size="sm" variant="secondary" loading={pending} disabled={!isDirty}>
          Salvar
        </Button>
      </form>
    </section>
  );
}
