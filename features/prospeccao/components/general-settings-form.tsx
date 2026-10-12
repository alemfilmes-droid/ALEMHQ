"use client";

import { useState } from "react";
import { CalendarClock, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeading } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { useSave } from "@/features/prospeccao/components/use-save";
import { generalSettingsSchema } from "@/features/prospeccao/schemas";
import { saveGeneralSettingsAction } from "@/features/prospeccao/settings-actions";
import type { GeneralSettings } from "@/features/prospeccao/types";

type Errors = Record<string, string>;

function collectErrors(values: GeneralSettings): Errors {
  const parsed = generalSettingsSchema.safeParse(values);
  if (parsed.success) return {};
  const errors: Errors = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.join(".");
    errors[key] ??= issue.message;
  }
  return errors;
}

/** Aba Geral: reuniões (duração e janelas) e metas de esforço do SDR. */
export function GeneralSettingsForm({ initial }: { initial: GeneralSettings }) {
  const [values, setValues] = useState(initial);
  const [showErrors, setShowErrors] = useState(false);
  const { pending, run } = useSave();
  const errors = showErrors ? collectErrors(values) : {};
  const set = <K extends keyof GeneralSettings>(key: K, value: GeneralSettings[K]) => setValues((current) => ({ ...current, [key]: value }));
  const setWindow = (index: number, field: "start" | "end", value: string) =>
    set(
      "meetingWindows",
      values.meetingWindows.map((window, i) => (i === index ? { ...window, [field]: value } : window)),
    );

  function save() {
    setShowErrors(true);
    if (Object.keys(collectErrors(values)).length) return;
    run(() => saveGeneralSettingsAction(values));
  }

  const numberField = (key: "meetingDurationMinutes" | "dailyTouchTarget" | "weeklyMeetingTarget" | "houseClientDelayDays", label: string, hint: string, min: number) => (
    <FormField id={`geral-${key}`} label={label} hint={hint} error={errors[key]}>
      <Input
        id={`geral-${key}`}
        type="number"
        inputMode="numeric"
        min={min}
        className="h-11"
        value={Number.isNaN(values[key]) ? "" : values[key]}
        onChange={(event) => set(key, event.target.value === "" ? Number.NaN : Number(event.target.value))}
        aria-invalid={errors[key] ? true : undefined}
        aria-describedby={`geral-${key}-message`}
      />
    </FormField>
  );

  return (
    <Card variant="static">
      <CardHeading icon={CalendarClock} tone="slate" title="Reuniões e metas de esforço" />
      <CardContent className="space-y-6">
        <section className="space-y-4" aria-labelledby="geral-reunioes">
          <h3 id="geral-reunioes" className="text-sm font-bold text-foreground">
            Reuniões
          </h3>
          <p className="text-[13px] text-muted-foreground">
            Usado em &quot;Marcar reunião&quot; para sugerir horários livres na agenda do Anderson. Só dias úteis, horário de Fortaleza.
          </p>
          <div className="max-w-xs">{numberField("meetingDurationMinutes", "Duração da reunião (minutos)", "Ex.: 45.", 1)}</div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-foreground">Janelas de horário para reuniões</legend>
            {errors.meetingWindows ? <p className="text-[13px] font-semibold text-foreground">{errors.meetingWindows}</p> : null}
            <ul className="space-y-3">
              {values.meetingWindows.map((window, index) => {
                const startError = errors[`meetingWindows.${index}.start`];
                const endError = errors[`meetingWindows.${index}.end`];
                return (
                  <li key={index} className="flex flex-wrap items-end gap-3 rounded-md border border-border p-3">
                    <FormField id={`janela-${index}-inicio`} label="Início" error={startError} className="min-w-28 flex-1">
                      <Input
                        id={`janela-${index}-inicio`}
                        type="time"
                        className="h-11"
                        value={window.start}
                        onChange={(event) => setWindow(index, "start", event.target.value)}
                        aria-invalid={startError ? true : undefined}
                        aria-describedby={`janela-${index}-inicio-message`}
                      />
                    </FormField>
                    <FormField id={`janela-${index}-fim`} label="Fim" error={endError} className="min-w-28 flex-1">
                      <Input
                        id={`janela-${index}-fim`}
                        type="time"
                        className="h-11"
                        value={window.end}
                        onChange={(event) => setWindow(index, "end", event.target.value)}
                        aria-invalid={endError ? true : undefined}
                        aria-describedby={`janela-${index}-fim-message`}
                      />
                    </FormField>
                    <Button
                      type="button"
                      variant="secondary"
                      size="lg"
                      onClick={() => set("meetingWindows", values.meetingWindows.filter((_, i) => i !== index))}
                    >
                      <Trash2 aria-hidden />
                      Remover
                    </Button>
                  </li>
                );
              })}
            </ul>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              disabled={values.meetingWindows.length >= 6}
              onClick={() => set("meetingWindows", [...values.meetingWindows, { start: "14:00", end: "17:00" }])}
            >
              <Plus aria-hidden />
              Adicionar janela
            </Button>
          </fieldset>
        </section>

        <section className="space-y-4 border-t border-border pt-6" aria-labelledby="geral-metas">
          <h3 id="geral-metas" className="text-sm font-bold text-foreground">
            Metas de esforço do SDR
          </h3>
          <p className="text-[13px] text-muted-foreground">O CRM vai comparar o que o SDR fez com estes alvos. Zero desliga a meta.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {numberField("dailyTouchTarget", "Meta de toques por dia", "Toques marcados como enviados.", 0)}
            {numberField("weeklyMeetingTarget", "Meta de reuniões por semana", "Reuniões marcadas, segunda a domingo.", 0)}
          </div>
        </section>

        <section className="space-y-4 border-t border-border pt-6" aria-labelledby="geral-casa">
          <h3 id="geral-casa" className="text-sm font-bold text-foreground">
            Cliente da casa
          </h3>
          <p className="text-[13px] text-muted-foreground">Quando um projeto é entregue, o cliente volta ao CRM com um playbook sugerido, depois deste prazo.</p>
          <div className="max-w-xs">{numberField("houseClientDelayDays", "Cliente da casa volta em (dias)", "Dias corridos depois da entrega.", 0)}</div>
        </section>

        <div className="flex justify-end">
          <Button type="button" size="lg" onClick={save} loading={pending}>
            <Save aria-hidden />
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
