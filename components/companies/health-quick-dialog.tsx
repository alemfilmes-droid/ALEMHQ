"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { updateCompanyHealthAction } from "@/app/(app)/clientes/actions";
import { StatusDot } from "@/components/ui/status-dot";
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
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CLIENT_HEALTHS, updateHealthSchema, type UpdateHealthValues } from "@/lib/validations/health";
import { CLIENT_HEALTH_LABELS, CLIENT_HEALTH_TONE } from "@/lib/status";
import type { Company } from "@/types";

interface HealthQuickDialogProps {
  company: Pick<Company, "id" | "name" | "health" | "health_note">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function HealthQuickDialog({ company, open, onOpenChange }: HealthQuickDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateHealthValues>({
    resolver: zodResolver(updateHealthSchema),
    defaultValues: { id: company.id, health: company.health, note: company.health_note ?? "" },
  });

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await updateCompanyHealthAction(values);
      if (result.ok) {
        toast.success(result.message);
        onOpenChange(false);
      } else {
        setError(result.error);
      }
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Saúde do cliente.</DialogTitle>
          <DialogDescription>{company.name}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {error ? <Alert variant="error">{error}</Alert> : null}
          <FormField id="health-select" label="Saúde" error={errors.health?.message}>
            <Controller
              control={control}
              name="health"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="health-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLIENT_HEALTHS.map((health) => (
                      <SelectItem key={health} value={health}>
                        <span className="flex items-center gap-2">
                          <StatusDot tone={CLIENT_HEALTH_TONE[health]} />
                          {CLIENT_HEALTH_LABELS[health]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>
          <FormField id="health-note" label="Nota" hint="Opcional. Visível para quem gerencia clientes." error={errors.note?.message}>
            <Textarea id="health-note" {...register("note")} />
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
