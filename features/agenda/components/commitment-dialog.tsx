"use client";

import { useState, useTransition } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ClientAvatar } from "@/components/companies/client-avatar";
import { MemberPicker } from "@/components/projects/member-picker";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { SearchSelect } from "@/components/ui/search-select";
import { StatusDot } from "@/components/ui/status-dot";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveCommitmentAction } from "@/features/agenda/actions";
import { RECURRENCES, RECURRENCE_LABELS, fromRRule } from "@/features/agenda/recurrence";
import { COMMITMENT_KINDS, REMINDER_OPTIONS, commitmentSchema, type CommitmentValues } from "@/features/agenda/schemas";
import type { AgendaConflict, AgendaFormOptions, CommitmentFormRow } from "@/features/agenda/types";
import { COMMITMENT_KIND_LABELS } from "@/features/crm/labels";
import { dateInAppZone, timeInAppZone } from "@/lib/calendar";
import { COMMITMENT_KIND_TONE } from "@/lib/status";

const REMINDER_LABELS: Record<(typeof REMINDER_OPTIONS)[number], string> = {
  "": "Sem lembrete",
  "10": "10 minutos antes",
  "30": "30 minutos antes",
  "60": "1 hora antes",
  "1440": "1 dia antes",
};

export type CommitmentDialogTarget =
  | { mode: "create"; date: string; startTime?: string; endTime?: string }
  | { mode: "edit"; row: CommitmentFormRow };

function toReminder(minutes: number[]): CommitmentValues["reminder"] {
  const first = minutes[0];
  if (first === undefined) return "";
  return REMINDER_OPTIONS.find((option) => option === String(first)) ?? "30";
}

function defaultsFor(target: CommitmentDialogTarget): CommitmentValues {
  if (target.mode === "edit") {
    const { row } = target;
    const { recurrence, until } = fromRRule(row.recurrenceRule);
    return {
      title: row.title,
      kind: row.kind,
      date: dateInAppZone(row.startsAt),
      allDay: row.allDay,
      startTime: row.allDay ? "09:00" : timeInAppZone(row.startsAt),
      endTime: row.allDay ? "10:00" : timeInAppZone(row.endsAt),
      attendees: row.attendees,
      externalAttendees: row.externalAttendees,
      location: row.location ?? "",
      notes: row.notes ?? "",
      companyId: row.companyId ?? "",
      projectId: row.projectId ?? "",
      dealId: row.dealId ?? "",
      pautaId: row.pautaId ?? "",
      reminder: toReminder(row.reminderMinutes),
      visibility: row.visibility,
      recurrence,
      recurrenceUntil: until,
    };
  }
  return {
    title: "",
    kind: "interno",
    date: target.date,
    allDay: false,
    startTime: target.startTime ?? "09:00",
    endTime: target.endTime ?? "10:00",
    attendees: [],
    externalAttendees: [],
    location: "",
    notes: "",
    companyId: "",
    projectId: "",
    dealId: "",
    pautaId: "",
    reminder: "30",
    visibility: "equipe",
    recurrence: "none",
    recurrenceUntil: "",
  };
}

interface CommitmentDialogProps {
  target: CommitmentDialogTarget;
  options: AgendaFormOptions;
  currentUserId: string;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

/**
 * Criar/editar compromisso. Antes de gravar, o servidor confere conflitos de horário do dono e dos
 * participantes; havendo conflito, mostramos o que conflita e a pessoa decide (ajustar ou salvar
 * mesmo assim). Captação oferece vincular uma pauta existente — ela passa a aparecer só por aqui.
 */
export function CommitmentDialog({ target, options, currentUserId, onOpenChange, onSaved }: CommitmentDialogProps) {
  const isEdit = target.mode === "edit";
  const ownerId = target.mode === "edit" ? target.row.ownerId : currentUserId;
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<{ items: AgendaConflict[]; values: CommitmentValues } | null>(null);
  const [pending, startTransition] = useTransition();

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<CommitmentValues>({ resolver: zodResolver(commitmentSchema), defaultValues: defaultsFor(target) });
  const externals = useFieldArray({ control, name: "externalAttendees" });

  const kind = watch("kind");
  const allDay = watch("allDay");
  const recurrence = watch("recurrence");
  const companyId = watch("companyId");
  const projectId = watch("projectId");

  function save(values: CommitmentValues, confirmConflicts: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await saveCommitmentAction(values, { id: isEdit ? target.row.id : undefined, confirmConflicts });
      if (!result.ok && "conflicts" in result) {
        setConflicts({ items: result.conflicts, values });
        return;
      }
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(result.message);
      onSaved();
    });
  }

  const onSubmit = handleSubmit((values) => save(values, false));

  // Vínculos em cascata: pauta → projeto → cliente.
  function selectPauta(id: string) {
    setValue("pautaId", id);
    const pauta = options.pautas.find((item) => item.id === id);
    if (!pauta) return;
    if (pauta.project_id) selectProject(pauta.project_id);
    if (!getValues("title").trim()) setValue("title", pauta.title);
  }
  function selectProject(id: string) {
    setValue("projectId", id);
    const project = options.projects.find((item) => item.id === id);
    if (project?.company_id) setValue("companyId", project.company_id);
  }
  function selectDeal(id: string) {
    setValue("dealId", id);
    const deal = options.deals.find((item) => item.id === id);
    if (deal?.company_id) setValue("companyId", deal.company_id);
  }

  const companyOptions = options.companies.map((company) => ({
    value: company.id,
    label: company.name,
    leading: <ClientAvatar name={company.name} logoUrl={company.logo_url} size="sm" />,
  }));
  const projectOptions = options.projects
    .filter((project) => !companyId || project.company_id === companyId || project.id === projectId)
    .map((project) => ({ value: project.id, label: project.name, hint: options.companies.find((company) => company.id === project.company_id)?.name }));
  const dealOptions = options.deals
    .filter((deal) => !companyId || deal.company_id === companyId)
    .map((deal) => ({ value: deal.id, label: deal.title, hint: deal.company_name }));
  const pautaOptions = options.pautas
    .filter((pauta) => !projectId || pauta.project_id === projectId)
    .map((pauta) => ({ value: pauta.id, label: pauta.title, hint: pauta.company_name }));

  const pautaField = (
    <Controller
      control={control}
      name="pautaId"
      render={({ field }) => (
        <SearchSelect id="commitment-pauta" value={field.value} onChange={selectPauta} options={pautaOptions} placeholder="Nenhuma pauta" emptyLabel="Nenhuma pauta em aberto." />
      )}
    />
  );

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar compromisso." : "Novo compromisso."}</DialogTitle>
          <DialogDescription>
            {isEdit && target.row.recurrenceRule ? "Compromisso recorrente: as alterações valem para toda a série." : "Aparece na agenda de quem participa."}
          </DialogDescription>
        </DialogHeader>

        {conflicts ? (
          <div className="space-y-4">
            <Alert variant="error" title="Conflito de horário.">
              Estas pessoas já têm algo no mesmo horário. Ajuste ou confirme assim mesmo.
            </Alert>
            <ul className="divide-y divide-border rounded-md border border-border">
              {conflicts.items.map((item, index) => (
                <li key={`${item.profileId}-${item.startsAt}-${index}`} className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 text-sm">
                  <span>
                    <span className="font-semibold">{item.profileName}</span>
                    <span className="text-muted-foreground"> — {item.title}</span>
                    {item.source === "pauta" ? <span className="text-subtle"> (pauta)</span> : null}
                  </span>
                  <span className="whitespace-nowrap text-[13px] tabular-nums text-subtle">
                    {timeInAppZone(item.startsAt)}–{timeInAppZone(item.endsAt)}
                  </span>
                </li>
              ))}
            </ul>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setConflicts(null)} disabled={pending}>
                Ajustar
              </Button>
              <Button type="button" loading={pending} onClick={() => save(conflicts.values, true)}>
                Salvar mesmo assim
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="space-y-5">
            {error ? <Alert variant="error">{error}</Alert> : null}

            <FormField id="commitment-title" label="Título" error={errors.title?.message}>
              <Input id="commitment-title" aria-invalid={!!errors.title} {...register("title")} />
            </FormField>

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField id="commitment-kind" label="Tipo">
                <Controller
                  control={control}
                  name="kind"
                  render={({ field }) => (
                    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-labelledby="commitment-kind">
                      {COMMITMENT_KINDS.map((item) => (
                        <button
                          key={item}
                          type="button"
                          role="radio"
                          aria-checked={field.value === item}
                          onClick={() => field.onChange(item)}
                          className={
                            field.value === item
                              ? "flex items-center gap-1.5 rounded-full border border-foreground px-2.5 py-1 text-[12px] font-bold"
                              : "flex items-center gap-1.5 rounded-full border border-border-strong px-2.5 py-1 text-[12px] font-semibold text-muted-foreground hover:text-foreground"
                          }
                        >
                          <StatusDot tone={COMMITMENT_KIND_TONE[item]} />
                          {COMMITMENT_KIND_LABELS[item]}
                        </button>
                      ))}
                    </div>
                  )}
                />
              </FormField>
              <FormField id="commitment-date" label="Data" error={errors.date?.message}>
                <Input id="commitment-date" type="date" aria-invalid={!!errors.date} {...register("date")} />
              </FormField>
            </div>

            {kind === "captacao" ? (
              <div className="space-y-2 rounded-md border border-border p-3">
                <Label htmlFor="commitment-pauta" className="flex items-center gap-1.5">
                  <Link2 className="size-3.5" aria-hidden />
                  Vincular a uma pauta existente
                </Label>
                {pautaField}
                <p className="text-[13px] text-muted-foreground">Opcional. A pauta vinculada passa a aparecer na agenda só por este compromisso.</p>
              </div>
            ) : null}

            <div className="flex items-center gap-3">
              <Controller
                control={control}
                name="allDay"
                render={({ field }) => <Switch id="commitment-all-day" checked={field.value} onCheckedChange={field.onChange} />}
              />
              <Label htmlFor="commitment-all-day">Dia inteiro</Label>
            </div>

            {!allDay ? (
              <div className="grid grid-cols-2 gap-5">
                <FormField id="commitment-start" label="Início" error={errors.startTime?.message}>
                  <Input id="commitment-start" type="time" aria-invalid={!!errors.startTime} {...register("startTime")} />
                </FormField>
                <FormField id="commitment-end" label="Fim" error={errors.endTime?.message}>
                  <Input id="commitment-end" type="time" aria-invalid={!!errors.endTime} {...register("endTime")} />
                </FormField>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>Participantes da equipe</Label>
              <Controller
                control={control}
                name="attendees"
                render={({ field }) => (
                  <MemberPicker
                    idPrefix="commitment-attendee"
                    legend="Participantes da equipe"
                    value={field.value}
                    onChange={field.onChange}
                    members={options.members.filter((member) => member.id !== ownerId)}
                  />
                )}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Participantes externos</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => externals.append({ name: "", email: "" })}>
                  <Plus aria-hidden />
                  Adicionar
                </Button>
              </div>
              {externals.fields.length === 0 ? <p className="text-[13px] text-subtle">Nenhum participante externo.</p> : null}
              {externals.fields.map((item, index) => (
                <div key={item.id} className="grid grid-cols-[1fr_1fr_auto] items-start gap-2">
                  <div>
                    <Input aria-label={`Nome do participante externo ${index + 1}`} placeholder="Nome" {...register(`externalAttendees.${index}.name`)} />
                    {errors.externalAttendees?.[index]?.name ? (
                      <p className="mt-1 text-[12px] font-semibold">{errors.externalAttendees[index]?.name?.message}</p>
                    ) : null}
                  </div>
                  <div>
                    <Input aria-label={`E-mail do participante externo ${index + 1}`} placeholder="E-mail" type="email" {...register(`externalAttendees.${index}.email`)} />
                    {errors.externalAttendees?.[index]?.email ? (
                      <p className="mt-1 text-[12px] font-semibold">{errors.externalAttendees[index]?.email?.message}</p>
                    ) : null}
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => externals.remove(index)} aria-label={`Remover participante externo ${index + 1}`}>
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              ))}
            </div>

            <FormField id="commitment-location" label="Local ou link" error={errors.location?.message}>
              <Input id="commitment-location" placeholder="Endereço ou link da chamada" {...register("location")} />
            </FormField>

            <fieldset className="space-y-4 rounded-md border border-border p-3">
              <legend className="px-1 text-sm font-semibold">Vínculos</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField id="commitment-company" label="Cliente">
                  <Controller
                    control={control}
                    name="companyId"
                    render={({ field }) => <SearchSelect id="commitment-company" value={field.value} onChange={field.onChange} options={companyOptions} placeholder="Nenhum cliente" />}
                  />
                </FormField>
                <FormField id="commitment-project" label="Projeto">
                  <Controller
                    control={control}
                    name="projectId"
                    render={({ field }) => (
                      <SearchSelect id="commitment-project" value={field.value} onChange={selectProject} options={projectOptions} placeholder="Nenhum projeto" />
                    )}
                  />
                </FormField>
                <FormField id="commitment-deal" label="Negócio (CRM)">
                  <Controller
                    control={control}
                    name="dealId"
                    render={({ field }) => (
                      <SearchSelect id="commitment-deal" value={field.value} onChange={selectDeal} options={dealOptions} placeholder="Nenhum negócio" emptyLabel="Nenhum negócio em aberto." />
                    )}
                  />
                </FormField>
                {kind !== "captacao" ? (
                  <FormField id="commitment-pauta" label="Pauta">
                    {pautaField}
                  </FormField>
                ) : null}
              </div>
            </fieldset>

            <div className="grid gap-5 sm:grid-cols-3">
              <FormField id="commitment-reminder" label="Lembrete">
                <NativeSelect id="commitment-reminder" {...register("reminder")}>
                  {REMINDER_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {REMINDER_LABELS[option]}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField id="commitment-visibility" label="Visibilidade">
                <NativeSelect id="commitment-visibility" {...register("visibility")}>
                  <option value="equipe">Equipe — todos do squad veem</option>
                  <option value="privado">Privado — outros veem “Ocupado”</option>
                </NativeSelect>
              </FormField>
              <FormField id="commitment-recurrence" label="Repetição">
                <NativeSelect id="commitment-recurrence" {...register("recurrence")}>
                  {RECURRENCES.map((option) => (
                    <option key={option} value={option}>
                      {RECURRENCE_LABELS[option]}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            </div>

            {recurrence !== "none" ? (
              <FormField id="commitment-until" label="Repetir até" hint="Opcional. Sem data, repete sem fim." error={errors.recurrenceUntil?.message}>
                <Input id="commitment-until" type="date" {...register("recurrenceUntil")} />
              </FormField>
            ) : null}

            <FormField id="commitment-notes" label="Observações" error={errors.notes?.message}>
              <Textarea id="commitment-notes" rows={3} {...register("notes")} />
            </FormField>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="secondary">
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" loading={pending}>
                {isEdit ? "Salvar" : "Criar compromisso"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
