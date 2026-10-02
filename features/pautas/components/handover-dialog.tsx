"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRightCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { getPautaDetailAction, handoverPautaAction } from "@/features/pautas/actions";
import type { PautaOptionMember } from "@/features/pautas/types";
import { requestProjectFinalizeCheck } from "@/features/projects/finalize-events";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusDot } from "@/components/ui/status-dot";
import { Textarea } from "@/components/ui/textarea";
import { FUNCTION_LABELS, PAUTA_ACTIVITIES_BY_SQUAD } from "@/lib/auth/roles";
import { pautaNoun, pautaStatusLabel, statusesForSquad } from "@/lib/pautas";
import { PAUTA_STATUS_TONE } from "@/lib/status";
import { handoverSchema, type HandoverValues } from "@/lib/validations/pauta";
import type { PautaStatus, PautaWithDetails, ProductionFunction } from "@/types";

interface HandoverDialogProps {
  pauta: PautaWithDetails;
  members: PautaOptionMember[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (pauta: PautaWithDetails) => void;
  /** Etapa já escolhida (ao arrastar o card ou pelos atalhos "Aprovar" / "Pedir ajuste"). */
  initialStatus?: PautaStatus;
  /** Quem criou a pauta (ou a gestão, se quem criou saiu): só essa pessoa aprova. */
  canApprove: boolean;
}

const REVIEW_STATUSES: PautaStatus[] = ["revisao_interna", "revisao_cliente"];

/** Para quem a etapa vai, por padrão: revisão volta ao líder; ajuste volta a quem executou. */
function defaultAssignee(pauta: PautaWithDetails, status: PautaStatus): string {
  if (REVIEW_STATUSES.includes(status)) return pauta.lead_id ?? "";
  if (status === "reajuste") return pauta.previous_assignee_id ?? pauta.current_assignee_id ?? "";
  return pauta.current_assignee_id ?? pauta.lead_id ?? "";
}

function defaultFunction(status: PautaStatus): ProductionFunction | "" {
  return REVIEW_STATUSES.includes(status) ? "revisao" : "";
}

function noteCopy(status: PautaStatus) {
  if (status === "aprovado") return { label: "Comentário da aprovação", hint: "Opcional. Fica nos registros da pauta." };
  if (status === "reajuste") return { label: "O que precisa ajustar", hint: "Obrigatório. Vai para o responsável e fica nos registros." };
  if (REVIEW_STATUSES.includes(status)) return { label: "O que foi feito", hint: "Conte o que você fez para quem vai revisar. Fica nos registros." };
  return { label: "Nota", hint: "Opcional. Fica nos registros da pauta." };
}

export function HandoverDialog({ pauta, members, open, onOpenChange, onDone, initialStatus, canApprove }: HandoverDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const squad = pauta.squad ?? "audiovisual";
  const statuses = statusesForSquad(squad).filter((status) => status !== "aprovado" || canApprove);
  const startStatus: PautaStatus = initialStatus && statuses.includes(initialStatus) ? initialStatus : (pauta.status ?? "planejamento");

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<HandoverValues>({
    resolver: zodResolver(handoverSchema),
    defaultValues: {
      pautaId: pauta.id!,
      status: startStatus,
      assigneeId: defaultAssignee(pauta, startStatus),
      functionRole: defaultFunction(startStatus),
      dueDate: pauta.due_date ?? "",
      dueTime: pauta.due_time ? pauta.due_time.slice(0, 5) : "",
      note: "",
    },
  });

  const status = watch("status");
  const approving = status === "aprovado";
  const copy = noteCopy(status);
  const noun = pautaNoun(squad);

  function chooseStatus(next: PautaStatus) {
    setValue("status", next);
    setValue("assigneeId", defaultAssignee(pauta, next));
    setValue("functionRole", defaultFunction(next));
  }

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await handoverPautaAction(values);
      if (!result.ok) return setError(result.error);
      toast.success(result.message);
      // Aprovou a última pauta de um projeto já pago: oferece finalizar o projeto.
      if (values.status === "aprovado") requestProjectFinalizeCheck(pauta.project_id);
      const detail = await getPautaDetailAction(pauta.id!);
      if (detail) onDone(detail.pauta);
      onOpenChange(false);
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{approving ? `Aprovar ${noun}.` : "Passar adiante."}</DialogTitle>
          <DialogDescription>{pauta.title}</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {error ? <Alert variant="error">{error}</Alert> : null}

          <FormField id="handover-status" label="Etapa" error={errors.status?.message}>
            <Select value={status} onValueChange={(value) => chooseStatus(value as PautaStatus)}>
              <SelectTrigger id="handover-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((item) => (
                  <SelectItem key={item} value={item}>
                    <span className="flex items-center gap-2">
                      <StatusDot tone={PAUTA_STATUS_TONE[item]} />
                      {pautaStatusLabel(item, squad)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {approving ? (
            <p className="rounded-md border border-border bg-surface-raised p-3 text-sm text-muted-foreground">
              A {noun} termina aqui: não vai para ninguém. Quem executou recebe o aviso de aprovação.
            </p>
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField id="handover-assignee" label="Para quem vai" error={errors.assigneeId?.message}>
                  <Controller
                    control={control}
                    name="assigneeId"
                    render={({ field }) => (
                      <Select value={field.value || undefined} onValueChange={field.onChange}>
                        <SelectTrigger id="handover-assignee" aria-invalid={!!errors.assigneeId}>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {members.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.full_name}
                              {member.id === pauta.lead_id ? " (líder)" : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </FormField>
                <FormField id="handover-function" label="O que vai fazer" error={errors.functionRole?.message}>
                  <Controller
                    control={control}
                    name="functionRole"
                    render={({ field }) => (
                      <Select value={field.value || undefined} onValueChange={field.onChange}>
                        <SelectTrigger id="handover-function" aria-invalid={!!errors.functionRole}>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {PAUTA_ACTIVITIES_BY_SQUAD[squad].map((fn) => (
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

              <div className="grid gap-5 sm:grid-cols-2">
                <FormField id="handover-due" label="Prazo da etapa" error={errors.dueDate?.message}>
                  <Input id="handover-due" type="date" {...register("dueDate")} />
                </FormField>
                <FormField id="handover-due-time" label="Até que horas" hint="Opcional." error={errors.dueTime?.message}>
                  <Input id="handover-due-time" type="time" {...register("dueTime")} />
                </FormField>
              </div>
            </>
          )}

          <FormField id="handover-note" label={copy.label} hint={copy.hint} error={errors.note?.message}>
            <Textarea id="handover-note" rows={4} {...register("note")} />
          </FormField>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              {approving ? <CheckCircle2 aria-hidden /> : <ArrowRightCircle aria-hidden />}
              {approving ? "Aprovar" : "Passar adiante"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
