"use client";

import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { saveCompanySettingsAction } from "@/features/settings/actions";
import type { CompanySettingsInput } from "@/features/settings/schemas";

const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
  { value: 7, label: "Dom" },
];

const format = (value: number) => String(value).replace(".", ",");

interface CompanySettingsFormProps {
  initial: { defaultDailyHours: number; defaultWorkdays: number[]; healthy: number; attention: number };
}

/** Jornada padrão de quem entra na equipe e limiares da margem (padrão: 8h seg–sex; margem saudável 40%, crítica abaixo de 30%). */
export function CompanySettingsForm({ initial }: CompanySettingsFormProps) {
  const [pending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<CompanySettingsInput>({
    defaultValues: {
      defaultDailyHours: format(initial.defaultDailyHours),
      defaultWorkdays: initial.defaultWorkdays,
      healthyMarginPct: format(initial.healthy),
      attentionMarginPct: format(initial.attention),
    },
  });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = await saveCompanySettingsAction(values);
      if (result.ok) {
        toast.success(result.message);
        reset(values);
      } else toast.error(result.error);
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="eyebrow mb-2">Jornada padrão de trabalho</legend>
        <FormField id="jornada-horas" label="Horas por dia" hint="Vale para quem entrar na equipe daqui em diante. A jornada de cada pessoa continua editável no Banco de Horas.">
          <Input id="jornada-horas" inputMode="decimal" className="w-28" aria-describedby="jornada-horas-message" {...register("defaultDailyHours")} />
        </FormField>
        <Controller
          control={control}
          name="defaultWorkdays"
          render={({ field }) => (
            <div className="flex flex-wrap gap-x-4 gap-y-2" role="group" aria-label="Dias de trabalho">
              {WEEKDAYS.map((day) => (
                <label key={day.value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={field.value.includes(day.value)}
                    onCheckedChange={(checked) =>
                      field.onChange(checked ? [...field.value, day.value] : field.value.filter((item) => item !== day.value))
                    }
                  />
                  {day.label}
                </label>
              ))}
            </div>
          )}
        />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="eyebrow mb-2">Margem dos projetos</legend>
        <div className="flex flex-wrap gap-4">
          <FormField id="margem-saudavel" label="Margem saudável alvo (%)" hint="A partir daqui, a margem é saudável.">
            <Input id="margem-saudavel" inputMode="decimal" className="w-28" aria-describedby="margem-saudavel-message" {...register("healthyMarginPct")} />
          </FormField>
          <FormField id="margem-atencao" label="Atenção a partir de (%)" hint="Abaixo disso, a margem é crítica.">
            <Input id="margem-atencao" inputMode="decimal" className="w-28" aria-describedby="margem-atencao-message" {...register("attentionMarginPct")} />
          </FormField>
        </div>
      </fieldset>

      <div className="flex justify-end">
        <Button type="submit" size="sm" variant="secondary" loading={pending} disabled={!isDirty}>
          Salvar
        </Button>
      </div>
    </form>
  );
}
