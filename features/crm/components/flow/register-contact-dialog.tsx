"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { getPendingAttemptAction, logContactAction } from "@/features/crm/actions";
import { FlowDialog } from "@/features/crm/components/flow/flow-dialog";
import { NextActionFields } from "@/features/crm/components/flow/fields";
import { INTERACTION_CHANNEL_LABELS, INTERACTION_CHANNELS } from "@/features/crm/labels";
import { contactSchema, type ContactValues } from "@/features/crm/schemas";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DealInteractionChannel, DealWithDetails } from "@/types";

interface RegisterContactDialogProps {
  deal: DealWithDetails;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}

type PendingAttempt = Awaited<ReturnType<typeof getPendingAttemptAction>>;

/**
 * "+ Registrar contato": mais uma tentativa (canal + abordagem + resumo), sem mudar de etapa. Antes de
 * registrar, a pessoa diz se a tentativa anterior teve resposta — isso pinta o histórico (verde/vermelho).
 */
export function RegisterContactDialog({ deal, open, onOpenChange, onDone }: RegisterContactDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [previous, setPrevious] = useState<PendingAttempt | undefined>(undefined);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      dealId: deal.id!,
      channel: undefined as never,
      approach: "",
      summary: "",
      body: "",
      nextStep: "",
      hasPendingAttempt: false,
      previousResponded: "",
      nextAction: "",
      nextActionDate: "",
      nextActionTime: "09:00",
    },
  });
  const previousResponded = watch("previousResponded");

  useEffect(() => {
    let active = true;
    getPendingAttemptAction(deal.id!).then((attempt) => {
      if (!active) return;
      setPrevious(attempt);
      setValue("hasPendingAttempt", attempt !== null);
    });
    return () => {
      active = false;
    };
  }, [deal.id, setValue]);

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await logContactAction(values);
      if (result.ok) {
        toast.success(result.message);
        onDone();
      } else {
        setError(result.error);
      }
    });
  });

  return (
    <FlowDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Registrar contato."
      description={`${deal.company_name} · ${deal.title}. Mais uma tentativa — a etapa continua a mesma.`}
      error={error}
      pending={pending || previous === undefined}
      submitLabel="Registrar contato"
      onSubmit={onSubmit}
      wide
    >
      {previous === undefined ? (
        <Skeleton className="h-16 w-full" />
      ) : previous ? (
        <fieldset className="space-y-2 rounded-md border border-border bg-surface-raised p-3">
          <legend className="px-1 text-sm font-semibold">A tentativa anterior teve resposta?</legend>
          <p className="text-[13px] text-muted-foreground">
            {formatDateTime(previous.occurredAt)}
            {previous.channel ? ` · ${INTERACTION_CHANNEL_LABELS[previous.channel as DealInteractionChannel]}` : ""} — {previous.summary}
          </p>
          <div className="flex gap-2" role="radiogroup" aria-label="A tentativa anterior teve resposta?">
            {(
              [
                ["sim", "Sim, respondeu"],
                ["nao", "Não respondeu"],
              ] as const
            ).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant="secondary"
                role="radio"
                aria-checked={previousResponded === value}
                className={cn(previousResponded === value && "border-foreground bg-surface-hover font-bold text-foreground")}
                onClick={() => setValue("previousResponded", value, { shouldValidate: true })}
              >
                {label}
              </Button>
            ))}
          </div>
          {errors.previousResponded?.message ? <p className="text-[13px] font-semibold">{errors.previousResponded.message}</p> : null}
        </fieldset>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id="contact-channel" label="Canal" error={errors.channel?.message}>
          <NativeSelect id="contact-channel" aria-invalid={!!errors.channel} defaultValue="" {...register("channel")}>
            <option value="" disabled>
              Selecione o canal
            </option>
            {INTERACTION_CHANNELS.map((channel) => (
              <option key={channel} value={channel}>
                {INTERACTION_CHANNEL_LABELS[channel]}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="contact-approach" label="Abordagem" hint="O gatilho ou tema usado." error={errors.approach?.message}>
          <Input id="contact-approach" placeholder="Ex.: case do concorrente" aria-invalid={!!errors.approach} {...register("approach")} />
        </FormField>
      </div>
      <FormField id="contact-summary" label="Resumo do que aconteceu" error={errors.summary?.message}>
        <Input
          id="contact-summary"
          placeholder="Ex.: Cliente disse que vai me encaminhar para o setor de marketing"
          aria-invalid={!!errors.summary}
          {...register("summary")}
        />
      </FormField>
      <FormField id="contact-body" label="Abordagem completa" hint="Opcional: a mensagem enviada ou o que foi dito." error={errors.body?.message}>
        <Textarea id="contact-body" rows={3} {...register("body")} />
      </FormField>
      <FormField id="contact-next-step" label="Próximo passo combinado" hint="Opcional." error={errors.nextStep?.message}>
        <Input id="contact-next-step" placeholder="Ex.: retornar na quinta com o material" {...register("nextStep")} />
      </FormField>
      <NextActionFields register={register} errors={errors} idPrefix="contact" optional />
      <p className="text-[13px] text-muted-foreground">
        Para atualizar a próxima ação, preencha texto e data. Se deixar em branco, a ação atual ({deal.next_action ?? "—"}) continua.
      </p>
    </FlowDialog>
  );
}
