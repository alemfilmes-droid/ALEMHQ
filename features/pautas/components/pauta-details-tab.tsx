"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { ArrowRightCircle, MapPin } from "lucide-react";
import { toast } from "sonner";
import { updatePautaAction } from "@/features/pautas/actions";
import { HandoverDialog } from "@/features/pautas/components/handover-dialog";
import type { PautaDetail, PautaFormOptions } from "@/features/pautas/types";
import { OwnerSelect } from "@/components/projects/owner-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusDot } from "@/components/ui/status-dot";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/ui/avatar";
import { FUNCTION_LABELS } from "@/lib/auth/roles";
import { formatDateTime } from "@/lib/format";
import { PAUTA_CAPTURE_TYPES, PAUTA_CAPTURE_TYPE_LABELS, PAUTA_STATUSES, PAUTA_STATUS_LABELS } from "@/lib/pautas";
import { PAUTA_STATUS_TONE } from "@/lib/status";
import type { PautaCaptureType, PautaStatus, PautaWithDetails } from "@/types";

interface FormValues {
  title: string;
  format: string;
  locationAddress: string;
  scheduledDate: string;
  scheduledTime: string;
  durationMinutes: string;
  startDate: string;
  dueDate: string;
  contactPhoneOverride: string;
  scriptUrl: string;
  driveFolderUrl: string;
  deliveryUrl: string;
  equipmentNotes: string;
  briefing: string;
}

function toFormValues(pauta: PautaWithDetails): FormValues {
  const scheduled = pauta.scheduled_at ? new Date(pauta.scheduled_at) : null;
  return {
    title: pauta.title ?? "",
    format: pauta.format ?? "",
    locationAddress: pauta.location_address ?? "",
    scheduledDate: scheduled ? scheduled.toISOString().slice(0, 10) : "",
    scheduledTime: scheduled ? scheduled.toISOString().slice(11, 16) : "",
    durationMinutes: pauta.duration_minutes != null ? String(pauta.duration_minutes) : "",
    startDate: pauta.start_date ?? "",
    dueDate: pauta.due_date ?? "",
    contactPhoneOverride: pauta.contact_phone_override ?? "",
    scriptUrl: pauta.script_url ?? "",
    driveFolderUrl: pauta.drive_folder_url ?? "",
    deliveryUrl: pauta.delivery_url ?? "",
    equipmentNotes: pauta.equipment_notes ?? "",
    briefing: pauta.briefing ?? "",
  };
}

const NO_FREELANCER = "__sem_freelancer__";

interface PautaDetailsTabProps {
  detail: PautaDetail;
  options: PautaFormOptions;
  /** Gestão plena: título, líder, prioridade e criticidade. */
  canManage: boolean;
  /** Gestão plena OU líder/responsável atual/membro: status e campos operacionais da etapa. */
  canEditOperationally: boolean;
  onChanged: (pauta: PautaWithDetails) => void;
}

export function PautaDetailsTab({ detail, options, canManage, canEditOperationally, onChanged }: PautaDetailsTabProps) {
  const { pauta, members } = detail;
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [quickPending, startQuickTransition] = useTransition();
  const [formPending, startFormTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm<FormValues>({ defaultValues: toFormValues(pauta) });

  function saveQuick(patch: Parameters<typeof updatePautaAction>[1], successMessage: string) {
    startQuickTransition(async () => {
      const result = await updatePautaAction(pauta.id!, patch);
      if (result.ok) {
        toast.success(successMessage);
        onChanged({ ...pauta, ...patch } as PautaWithDetails);
      } else {
        toast.error(result.error);
      }
    });
  }

  const onSubmit = handleSubmit((values) => {
    startFormTransition(async () => {
      const scheduledAt = values.scheduledDate && values.scheduledTime ? new Date(`${values.scheduledDate}T${values.scheduledTime}:00`).toISOString() : null;
      const result = await updatePautaAction(pauta.id!, {
        title: values.title,
        format: values.format || null,
        locationAddress: values.locationAddress || null,
        scheduledAt,
        durationMinutes: values.durationMinutes === "" ? null : Number(values.durationMinutes),
        startDate: values.startDate || null,
        dueDate: values.dueDate || null,
        contactPhoneOverride: values.contactPhoneOverride || null,
        scriptUrl: values.scriptUrl || null,
        driveFolderUrl: values.driveFolderUrl || null,
        deliveryUrl: values.deliveryUrl || null,
        equipmentNotes: values.equipmentNotes || null,
        briefing: values.briefing || null,
      });
      if (result.ok) {
        toast.success("Salvo.");
        reset(values);
        onChanged({
          ...pauta,
          title: values.title,
          format: values.format || null,
          location_address: values.locationAddress || null,
          scheduled_at: scheduledAt,
          duration_minutes: values.durationMinutes === "" ? null : Number(values.durationMinutes),
          start_date: values.startDate || null,
          due_date: values.dueDate || null,
          briefing: values.briefing || null,
        } as PautaWithDetails);
      } else {
        toast.error(result.error);
      }
    });
  });

  return (
    <div className="space-y-6">
      {canEditOperationally ? (
        <Button type="button" onClick={() => setHandoverOpen(true)} className="w-full sm:w-auto">
          <ArrowRightCircle aria-hidden />
          Passar adiante
        </Button>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField id="pd-status" label="Status">
          <Select
            value={pauta.status ?? undefined}
            disabled={!canEditOperationally || quickPending}
            onValueChange={(value) => saveQuick({ status: value as PautaStatus }, "Status atualizado.")}
          >
            <SelectTrigger id="pd-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAUTA_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  <span className="flex items-center gap-2">
                    <StatusDot tone={PAUTA_STATUS_TONE[status]} />
                    {PAUTA_STATUS_LABELS[status]}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField id="pd-lead" label="Líder">
          <OwnerSelect
            id="pd-lead"
            value={pauta.lead_id ?? ""}
            members={options.members}
            invalid={false}
            disabled={!canManage || quickPending}
            onChange={(value: string) => saveQuick({ leadId: value }, "Líder atualizado.")}
          />
        </FormField>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-3">
        <Label htmlFor="pd-critical" className="cursor-pointer">
          Pauta crítica
        </Label>
        <Switch
          id="pd-critical"
          checked={pauta.is_critical ?? false}
          disabled={!canManage || quickPending}
          onCheckedChange={(checked) => saveQuick({ isCritical: checked }, checked ? "Marcada como crítica." : "Deixou de ser crítica.")}
        />
      </div>

      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="eyebrow">Responsável atual</dt>
          <dd className="mt-1 flex items-center gap-2 font-semibold">
            <UserAvatar name={pauta.assignee_name ?? "—"} src={pauta.assignee_avatar_url} profileId={pauta.current_assignee_id} className="size-6" />
            {pauta.assignee_name ?? "—"}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="eyebrow">Freelancer</dt>
          <dd className="mt-1">
            {canEditOperationally && options.freelancers.length > 0 ? (
              <Select
                value={pauta.freelancer_id ?? NO_FREELANCER}
                disabled={quickPending}
                onValueChange={(value) => {
                  const freelancerId = value === NO_FREELANCER ? null : value;
                  const name = options.freelancers.find((item) => item.id === freelancerId)?.full_name ?? null;
                  startQuickTransition(async () => {
                    const result = await updatePautaAction(pauta.id!, { freelancerId });
                    if (!result.ok) {
                      toast.error(result.error);
                      return;
                    }
                    toast.success(freelancerId ? "Freelancer definido." : "Freelancer removido.");
                    onChanged({ ...pauta, freelancer_id: freelancerId, freelancer_name: name } as PautaWithDetails);
                  });
                }}
              >
                <SelectTrigger aria-label="Freelancer" className="sm:w-80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_FREELANCER}>Sem freelancer</SelectItem>
                  {options.freelancers.map((freelancer) => (
                    <SelectItem key={freelancer.id} value={freelancer.id}>
                      {freelancer.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="font-semibold">{pauta.freelancer_name ?? "—"}</span>
            )}
            {pauta.freelancer_id ? (
              <span className="mt-1 block text-[12px] text-subtle">
                Execução com o freelancer{pauta.freelancer_phone ? ` (${pauta.freelancer_phone})` : ""}. Quem cobra é o responsável: {pauta.assignee_name ?? pauta.lead_name ?? "—"}.
              </span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt className="eyebrow">Contato</dt>
          <dd className="mt-1 font-semibold">
            {pauta.contact_name ?? "—"}
            {pauta.contact_phone ? <span className="block text-[13px] font-normal text-muted-foreground">{pauta.contact_phone}</span> : null}
          </dd>
        </div>
      </dl>

      {members.length > 0 ? (
        <div>
          <p className="eyebrow mb-2">Responsáveis</p>
          <ul className="flex flex-wrap gap-2">
            {members.map((member) => (
              <li key={`${member.profile_id}-${member.production_function}`}>
                <Badge variant="muted">
                  <UserAvatar name={member.profile?.full_name ?? "—"} src={member.profile?.avatar_url ?? null} profileId={member.profile_id} className="size-4" />
                  {member.profile?.full_name} · {FUNCTION_LABELS[member.production_function]}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {pauta.location_address ? (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pauta.location_address)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground underline underline-offset-4 hover:text-muted-foreground"
        >
          <MapPin className="size-4" aria-hidden />
          Abrir no Maps
        </a>
      ) : null}

      <form onSubmit={onSubmit} noValidate className="space-y-5 border-t border-border pt-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="pd-title" label="Título">
            <Input id="pd-title" disabled={!canManage} {...register("title")} />
          </FormField>
          <fieldset className="flex items-end gap-4">
            {PAUTA_CAPTURE_TYPES.map((item: PautaCaptureType) => (
              <div key={item} className="flex items-center gap-2">
                <Checkbox id={`pd-capture-${item}`} checked={(pauta.capture_type ?? []).includes(item)} disabled={!canEditOperationally || quickPending} onCheckedChange={(checked) => {
                  const current = pauta.capture_type ?? [];
                  const next = checked ? [...current, item] : current.filter((v) => v !== item);
                  saveQuick({ captureType: next }, "Tipo atualizado.");
                }} />
                <Label htmlFor={`pd-capture-${item}`} className="cursor-pointer font-normal">
                  {PAUTA_CAPTURE_TYPE_LABELS[item]}
                </Label>
              </div>
            ))}
          </fieldset>
          <FormField id="pd-format" label="Formato">
            <Input id="pd-format" disabled={!canEditOperationally} {...register("format")} />
          </FormField>
          <FormField id="pd-location" label="Local">
            <Input id="pd-location" disabled={!canEditOperationally} {...register("locationAddress")} />
          </FormField>
          <FormField id="pd-scheduled-date" label="Data">
            <Input id="pd-scheduled-date" type="date" disabled={!canEditOperationally} {...register("scheduledDate")} />
          </FormField>
          <FormField id="pd-scheduled-time" label="Horário">
            <Input id="pd-scheduled-time" type="time" disabled={!canEditOperationally} {...register("scheduledTime")} />
          </FormField>
          <FormField id="pd-duration" label="Duração (min)">
            <Input id="pd-duration" inputMode="numeric" disabled={!canEditOperationally} {...register("durationMinutes")} />
          </FormField>
          <FormField id="pd-start" label="Data inicial">
            <Input id="pd-start" type="date" disabled={!canEditOperationally} {...register("startDate")} />
          </FormField>
          <FormField id="pd-due" label="Prazo">
            <Input id="pd-due" type="date" disabled={!canEditOperationally} {...register("dueDate")} />
          </FormField>
          <FormField id="pd-phone" label="Telefone (substitui o do contato)">
            <Input id="pd-phone" disabled={!canEditOperationally} {...register("contactPhoneOverride")} />
          </FormField>
          <FormField id="pd-script" label="Roteiro (link)">
            <Input id="pd-script" disabled={!canEditOperationally} {...register("scriptUrl")} />
          </FormField>
          <FormField id="pd-drive" label="Pasta do Drive">
            <Input id="pd-drive" disabled={!canEditOperationally} {...register("driveFolderUrl")} />
          </FormField>
          <FormField id="pd-delivery" label="Link de entrega">
            <Input id="pd-delivery" disabled={!canEditOperationally} {...register("deliveryUrl")} />
          </FormField>
        </div>

        <FormField id="pd-equipment" label="Equipamentos">
          <Textarea id="pd-equipment" disabled={!canEditOperationally} {...register("equipmentNotes")} />
        </FormField>

        <FormField id="pd-briefing" label="Briefing / descritivo">
          <Textarea id="pd-briefing" rows={5} disabled={!canEditOperationally} {...register("briefing")} />
        </FormField>

        {canEditOperationally ? (
          <Button type="submit" loading={formPending} disabled={!isDirty}>
            Salvar alterações
          </Button>
        ) : null}
      </form>

      <p className="text-xs text-subtle">Criada em {formatDateTime(pauta.created_at!)}. Código {pauta.code}.</p>

      {handoverOpen ? (
        <HandoverDialog
          pauta={pauta}
          members={options.members}
          open={handoverOpen}
          onOpenChange={setHandoverOpen}
          onDone={onChanged}
        />
      ) : null}
    </div>
  );
}
