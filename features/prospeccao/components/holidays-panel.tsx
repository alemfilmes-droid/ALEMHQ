"use client";

import { useState } from "react";
import { CalendarOff, Check, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeading } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { useSave } from "@/features/prospeccao/components/use-save";
import { addHolidayAction, confirmHolidayAction, removeHolidayAction, setHolidaySkipAction } from "@/features/prospeccao/holiday-actions";
import { Switch } from "@/components/ui/switch";
import { HOLIDAY_SCOPES, HOLIDAY_SCOPE_LABELS } from "@/features/prospeccao/labels";
import type { HolidayInput } from "@/features/prospeccao/schemas";
import { formatDate } from "@/lib/format";
import { weekdayShort } from "@/lib/calendar";
import type { ProspectHoliday } from "@/types";

function dayMonth(date: string): string {
  return `${date.slice(8, 10)}/${date.slice(5, 7)}`;
}

/** Aba Feriados: dias pulados pela cadência (fixos todo ano + móveis ano a ano). */
export function HolidaysPanel({ holidays, today }: { holidays: ProspectHoliday[]; today: string }) {
  const currentYear = today.slice(0, 4);
  const years = [...new Set([currentYear, ...holidays.filter((item) => !item.recurring).map((item) => item.holiday_date.slice(0, 4))])].sort();
  const [year, setYear] = useState(currentYear);
  const recurring = holidays.filter((item) => item.recurring).sort((a, b) => a.holiday_date.slice(5).localeCompare(b.holiday_date.slice(5)));
  const movable = holidays.filter((item) => !item.recurring && item.holiday_date.startsWith(year));

  return (
    <div className="grid gap-6">
      <p className="text-sm text-muted-foreground">
        Fim de semana e feriado são pulados: o toque cai no próximo dia útil. Pontos facultativos (Carnaval, Corpus Christi) são pulados enquanto
        &quot;Pular na prospecção&quot; estiver ligado. Feriados marcados &quot;a confirmar&quot; esperam a sua conferência.
      </p>
      <NewHolidayForm today={today} />
      <Card variant="static">
        <CardHeading icon={CalendarOff} tone="slate" title={`Todo ano · ${recurring.length}`} />
        <CardContent>
          <HolidayList items={recurring} label={(item) => dayMonth(item.holiday_date)} />
        </CardContent>
      </Card>
      <Card variant="static">
        <CardHeading
          icon={CalendarOff}
          tone="slate"
          title={`Datas móveis · ${movable.length}`}
          action={
            <label className="flex items-center gap-2 text-sm">
              <span className="sr-only">Ano</span>
              <NativeSelect className="h-11 w-28" value={year} onChange={(event) => setYear(event.target.value)} aria-label="Ano">
                {years.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </NativeSelect>
            </label>
          }
        />
        <CardContent>
          {movable.length ? (
            <HolidayList items={movable} label={(item) => `${weekdayShort(item.holiday_date)}, ${formatDate(item.holiday_date)}`} />
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum feriado móvel em {year}.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function HolidayList({ items, label }: { items: ProspectHoliday[]; label: (item: ProspectHoliday) => string }) {
  return (
    <ul className="divide-y divide-border">
      {items.map((item) => (
        <HolidayRow key={item.id} item={item} label={label(item)} />
      ))}
    </ul>
  );
}

function HolidayRow({ item, label }: { item: ProspectHoliday; label: string }) {
  const remove = useSave();
  const confirm = useSave();
  const skip = useSave();
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
      <span className="w-28 shrink-0 font-mono text-sm text-foreground">{label}</span>
      <span className="min-w-0 flex-1 text-sm text-foreground">{item.name}</span>
      <span className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline">{HOLIDAY_SCOPE_LABELS[item.scope]}</Badge>
        {item.needs_confirmation ? <Badge variant="muted">a confirmar</Badge> : null}
        {item.optional ? <Badge variant="muted">Ponto facultativo</Badge> : null}
      </span>
      {item.optional ? (
        <label className="flex min-h-11 items-center gap-2 text-[13px] text-foreground">
          <Switch checked={item.skip_prospecting} disabled={skip.pending} onCheckedChange={(checked) => skip.run(() => setHolidaySkipAction(item.id, checked))} />
          Pular na prospecção
        </label>
      ) : null}
      <span className="flex gap-2">
        {item.needs_confirmation ? (
          <Button type="button" variant="secondary" size="lg" loading={confirm.pending} onClick={() => confirm.run(() => confirmHolidayAction(item.id))}>
            <Check aria-hidden />
            Confirmar
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="lg"
          aria-label={`Remover ${item.name}`}
          loading={remove.pending}
          onClick={() => remove.run(() => removeHolidayAction(item.id))}
        >
          <Trash2 aria-hidden />
          <span className="sr-only sm:not-sr-only">Remover</span>
        </Button>
      </span>
    </li>
  );
}

function NewHolidayForm({ today }: { today: string }) {
  const empty: HolidayInput = { date: today, name: "", scope: "natal", recurring: false };
  const [draft, setDraft] = useState(empty);
  const { pending, run } = useSave();
  const set = <K extends keyof HolidayInput>(key: K, value: HolidayInput[K]) => setDraft((current) => ({ ...current, [key]: value }));

  return (
    <Card variant="static">
      <CardHeading icon={Plus} tone="slate" title="Adicionar feriado" />
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[10rem_minmax(0,1fr)_9rem]">
          <FormField id="feriado-data" label="Data">
            <Input id="feriado-data" type="date" className="h-11" value={draft.date} onChange={(event) => set("date", event.target.value)} />
          </FormField>
          <FormField id="feriado-nome" label="Nome">
            <Input id="feriado-nome" className="h-11" value={draft.name} onChange={(event) => set("name", event.target.value)} maxLength={120} />
          </FormField>
          <FormField id="feriado-abrangencia" label="Abrangência">
            <NativeSelect
              id="feriado-abrangencia"
              className="h-11"
              value={draft.scope}
              onChange={(event) => set("scope", event.target.value as HolidayInput["scope"])}
            >
              {HOLIDAY_SCOPES.map((scope) => (
                <option key={scope} value={scope}>
                  {HOLIDAY_SCOPE_LABELS[scope]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-h-11 items-center gap-3">
            <Checkbox id="feriado-recorrente" className="size-5" checked={draft.recurring} onCheckedChange={(checked) => set("recurring", checked === true)} />
            <label htmlFor="feriado-recorrente" className="text-sm">
              Repete todo ano no mesmo dia
            </label>
          </div>
          <Button type="button" size="lg" loading={pending} onClick={() => run(() => addHolidayAction(draft), () => setDraft(empty))}>
            <Plus aria-hidden />
            Adicionar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
