"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRightCircle } from "lucide-react";
import { toast } from "sonner";
import { getPautaDetailAction, handoverPautaAction } from "@/features/pautas/actions";
import type { PautaOptionMember } from "@/features/pautas/types";
import { PautaStatusBadge } from "@/features/pautas/components/pauta-status-badge";
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
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FUNCTION_LABELS, PRODUCTION_FUNCTIONS } from "@/lib/auth/roles";
import { PAUTA_STATUSES } from "@/lib/pautas";
import { handoverSchema, type HandoverValues } from "@/lib/validations/pauta";
import type { PautaWithDetails } from "@/types";

interface HandoverDialogProps {
  pauta: PautaWithDetails;
  members: PautaOptionMember[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (pauta: PautaWithDetails) => void;
}

export function HandoverDialog({ pauta, members, open, onOpenChange, onDone }: HandoverDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<HandoverValues>({
    resolver: zodResolver(handoverSchema),
    defaultValues: {
      pautaId: pauta.id!,
      status: pauta.status!,
      assigneeId: pauta.current_assignee_id ?? pauta.lead_id!,
      functionRole: undefined as never,
      dueDate: pauta.due_date ?? "",
      note: "",
    },
  });

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await handoverPautaAction(values);
      if (!result.ok) return setError(result.error);
      toast.success(result.message);
      const detail = await getPautaDetailAction(pauta.id!);
      if (detail) onDone(detail.pauta);
      onOpenChange(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Passar adiante.</DialogTitle>
          <DialogDescription>{pauta.title}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {error ? <Alert variant="error">{error}</Alert> : null}

          <FormField id="handover-status" label="Próximo status" error={errors.status?.message}>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="handover-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAUTA_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        <span className="flex items-center gap-2">
                          <PautaStatusBadge status={status} />
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField id="handover-assignee" label="Responsável pela etapa" error={errors.assigneeId?.message}>
              <Controller
                control={control}
                name="assigneeId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="handover-assignee" aria-invalid={!!errors.assigneeId}>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
            <FormField id="handover-function" label="Função" error={errors.functionRole?.message}>
              <Controller
                control={control}
                name="functionRole"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="handover-function" aria-invalid={!!errors.functionRole}>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCTION_FUNCTIONS.map((fn) => (
                        <SelectItem key={fn} value={fn}>
                          {FUNCTION_LABELS[fn]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          </div>

          <FormField id="handover-due" label="Prazo da etapa" hint="Opcional." error={errors.dueDate?.message}>
            <Input id="handover-due" type="date" {...register("dueDate")} />
          </FormField>

          <FormField id="handover-note" label="Nota" hint="Opcional. Fica registrada no histórico." error={errors.note?.message}>
            <Textarea id="handover-note" {...register("note")} />
          </FormField>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              <ArrowRightCircle aria-hidden />
              Passar adiante
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
