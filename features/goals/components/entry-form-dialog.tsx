"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { centsToInput } from "@/features/finance/money";
import { saveEntryAction } from "@/features/goals/actions";
import { entrySchema, type EntryValues } from "@/features/goals/schemas";
import type { GoalEntryItem, GoalItem } from "@/features/goals/types";
import { todayInAppZone } from "@/lib/calendar";

interface EntryFormDialogProps {
  goal: GoalItem;
  entry?: GoalEntryItem;
  /** Diretoria lança já aprovado. */
  isManager: boolean;
  onOpenChange: (open: boolean) => void;
}

const decimal = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2, useGrouping: false });

export function EntryFormDialog({ goal, entry, isManager, onOpenChange }: EntryFormDialogProps) {
  const [pending, startTransition] = useTransition();
  const today = todayInAppZone();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EntryValues>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      amount: entry ? (goal.isMoney ? centsToInput(entry.amount) : decimal.format(entry.amount / 100)) : "",
      entryDate: entry?.entryDate ?? (today > goal.endsOn ? goal.endsOn : today),
      note: entry?.note ?? "",
      linkUrl: entry?.linkUrl ?? "",
    },
  });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = await saveEntryAction(goal.id, values, entry?.id);
      if (result.ok) {
        toast.success(result.message);
        onOpenChange(false);
      } else toast.error(result.error);
    });
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{entry ? "Editar lançamento." : "Novo lançamento."}</DialogTitle>
          <DialogDescription>
            {isManager ? "Lançado por você, entra aprovado." : "Entra como a confirmar até a diretoria revisar."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="lanc-valor" label={goal.isMoney ? "Valor (R$)" : "Quantidade"} error={errors.amount?.message}>
              <Input id="lanc-valor" inputMode="decimal" autoFocus placeholder={goal.isMoney ? "5.000,00" : "1"} aria-invalid={!!errors.amount} {...register("amount")} />
            </FormField>
            <FormField id="lanc-data" label="Data" error={errors.entryDate?.message}>
              <Input id="lanc-data" type="date" min={goal.startsOn} max={goal.endsOn} {...register("entryDate")} />
            </FormField>
          </div>
          <FormField id="lanc-nota" label="O que foi" error={errors.note?.message}>
            <Textarea id="lanc-nota" rows={3} placeholder="Cliente, negócio, reunião… o que ajuda a revisar." {...register("note")} />
          </FormField>
          <FormField id="lanc-link" label="Link de comprovante (opcional)" error={errors.linkUrl?.message}>
            <Input id="lanc-link" type="url" placeholder="https://" aria-invalid={!!errors.linkUrl} {...register("linkUrl")} />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              {entry ? "Salvar" : "Lançar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
