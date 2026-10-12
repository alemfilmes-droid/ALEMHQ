"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { effectiveDefaults } from "@/lib/crm/effective-time";

export interface EffectiveTimeValue {
  date: string;
  time: string;
}

interface EffectiveTimeFieldProps {
  idPrefix: string;
  /** null = agora (padrão). */
  value: EffectiveTimeValue | null;
  onChange: (value: EffectiveTimeValue | null) => void;
  error?: string;
}

/**
 * Horário do contato: agora, por padrão. "Fiz em outro horário" abre data e hora (até 7 dias para
 * trás, nunca no futuro — o servidor e o banco conferem de novo).
 */
export function EffectiveTimeField({ idPrefix, value, onChange, error }: EffectiveTimeFieldProps) {
  const [limits] = useState(() => effectiveDefaults());

  if (!value) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="size-4" aria-hidden />
          Horário: agora
        </span>
        <Button type="button" variant="link" className="min-h-11 sm:min-h-0" onClick={() => onChange({ date: limits.date, time: limits.time })}>
          Fiz em outro horário
        </Button>
      </div>
    );
  }

  return (
    <fieldset className="space-y-2 rounded-md border border-border-strong p-3">
      <legend className="eyebrow px-1">Quando o contato foi feito</legend>
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField id={`${idPrefix}-occurred-date`} label="Data" error={error}>
          <Input
            id={`${idPrefix}-occurred-date`}
            type="date"
            min={limits.minDate}
            max={limits.maxDate}
            value={value.date}
            aria-invalid={!!error}
            onChange={(event) => onChange({ ...value, date: event.target.value })}
          />
        </FormField>
        <FormField id={`${idPrefix}-occurred-time`} label="Horário">
          <Input id={`${idPrefix}-occurred-time`} type="time" value={value.time} onChange={(event) => onChange({ ...value, time: event.target.value })} />
        </FormField>
      </div>
      <p className="text-[12px] text-muted-foreground">Até 7 dias para trás. A cadência conta a partir deste horário.</p>
      <Button type="button" variant="link" className="min-h-11 sm:min-h-0" onClick={() => onChange(null)}>
        Usar agora
      </Button>
    </fieldset>
  );
}
