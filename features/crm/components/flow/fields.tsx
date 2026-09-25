"use client";

import type { FieldErrors, FieldValues, Path, UseFormRegister } from "react-hook-form";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { INTERACTION_CHANNELS, INTERACTION_CHANNEL_LABELS } from "@/features/crm/labels";

export interface NextActionShape {
  nextAction: string;
  nextActionDate: string;
  nextActionTime: string;
}

export interface InteractionShape {
  channel: string;
  approach: string;
  body: string;
}

function message<F extends FieldValues>(errors: FieldErrors<F>, name: string): string | undefined {
  const entry = (errors as Record<string, { message?: unknown } | undefined>)[name];
  return typeof entry?.message === "string" ? entry.message : undefined;
}

interface FieldsProps<F extends FieldValues> {
  register: UseFormRegister<F>;
  errors: FieldErrors<F>;
  idPrefix: string;
}

/** Próxima ação: texto + data + hora. Obrigatória em qualquer negócio aberto. */
export function NextActionFields<F extends FieldValues & NextActionShape>({
  register,
  errors,
  idPrefix,
  optional = false,
}: FieldsProps<F> & { optional?: boolean }) {
  return (
    <div className="space-y-3">
      <FormField id={`${idPrefix}-next-action`} label="Próxima ação" hint={optional ? "Opcional." : undefined} error={message(errors, "nextAction")}>
        <Input
          id={`${idPrefix}-next-action`}
          placeholder="Ex.: ligar para confirmar a proposta"
          aria-invalid={!!message(errors, "nextAction")}
          {...register("nextAction" as Path<F>)}
        />
      </FormField>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id={`${idPrefix}-next-date`} label="Quando" error={message(errors, "nextActionDate")}>
          <Input id={`${idPrefix}-next-date`} type="date" aria-invalid={!!message(errors, "nextActionDate")} {...register("nextActionDate" as Path<F>)} />
        </FormField>
        <FormField id={`${idPrefix}-next-time`} label="Horário" error={message(errors, "nextActionTime")}>
          <Input id={`${idPrefix}-next-time`} type="time" {...register("nextActionTime" as Path<F>)} />
        </FormField>
      </div>
    </div>
  );
}

/** O que foi feito no contato: canal, abordagem (gatilho usado) e o que foi dito. */
export function InteractionFields<F extends FieldValues & InteractionShape>({
  register,
  errors,
  idPrefix,
  requireApproach = true,
  bodyLabel = "O que foi dito ou feito",
}: FieldsProps<F> & { requireApproach?: boolean; bodyLabel?: string }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id={`${idPrefix}-channel`} label="Canal" error={message(errors, "channel")}>
          <NativeSelect id={`${idPrefix}-channel`} aria-invalid={!!message(errors, "channel")} defaultValue="" {...register("channel" as Path<F>)}>
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
        <FormField
          id={`${idPrefix}-approach`}
          label="Abordagem"
          hint={requireApproach ? "O gatilho ou tema usado." : "Opcional."}
          error={message(errors, "approach")}
        >
          <Input id={`${idPrefix}-approach`} placeholder="Ex.: case do concorrente" aria-invalid={!!message(errors, "approach")} {...register("approach" as Path<F>)} />
        </FormField>
      </div>
      <FormField id={`${idPrefix}-body`} label={bodyLabel} error={message(errors, "body")}>
        <Textarea id={`${idPrefix}-body`} rows={3} aria-invalid={!!message(errors, "body")} {...register("body" as Path<F>)} />
      </FormField>
    </div>
  );
}
