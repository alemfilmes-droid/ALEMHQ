"use client";

import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { createPautaAction, getPautaDetailAction } from "@/features/pautas/actions";
import type { PautaFormOptions } from "@/features/pautas/types";
import { OwnerSelect } from "@/components/projects/owner-select";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PAUTA_CAPTURE_TYPES, PAUTA_CAPTURE_TYPE_LABELS } from "@/lib/pautas";
import { PRIORITIES, PRIORITY_LABELS } from "@/lib/domain";
import { createPautaSchema, type CreatePautaValues } from "@/lib/validations/pauta";
import type { PautaColumn, PautaWithDetails } from "@/types";

interface NewPautaDialogProps {
  options: PautaFormOptions;
  defaultOwnerId: string;
  defaultColumn?: PautaColumn;
  lockedProjectId?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCreated?: (pauta: PautaWithDetails) => void;
  trigger?: React.ReactNode;
}

const NO_CONTACT = "none";

function emptyValues(props: NewPautaDialogProps): CreatePautaValues {
  return {
    projectId: props.lockedProjectId ?? "",
    title: "",
    briefing: "",
    leadId: props.defaultOwnerId,
    boardColumn: props.defaultColumn ?? "",
    priority: "media",
    isCritical: false,
    captureType: [],
    format: "",
    locationAddress: "",
    scheduledDate: "",
    scheduledTime: "",
    durationMinutes: "",
    startDate: "",
    dueDate: "",
    contactId: "",
    contactPhoneOverride: "",
    driveFolderUrl: "",
    scriptUrl: "",
    equipmentNotes: "",
  };
}

export function NewPautaDialog(props: NewPautaDialogProps) {
  const { options, lockedProjectId, onCreated } = props;
  const [internalOpen, setInternalOpen] = useState(false);
  const controlled = props.open !== undefined;
  const open = controlled ? props.open === true : internalOpen;
  const setOpen = (next: boolean) => (controlled ? props.onOpenChange?.(next) : setInternalOpen(next));

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreatePautaValues>({ resolver: zodResolver(createPautaSchema), defaultValues: emptyValues(props) });
  const projectId = watch("projectId");
  const projectContacts = options.contacts.filter((contact) => {
    const project = options.projects.find((item) => item.id === projectId);
    return project && contact.company_id === project.company_id;
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    setError(null);
    if (next) reset(emptyValues(props));
  }

  const onSubmit = handleSubmit((values) => {
    setError(null);
    startTransition(async () => {
      const result = await createPautaAction(values);
      if (!result.ok) return setError(result.error);
      toast.success(result.message);
      handleOpenChange(false);
      if (result.id && onCreated) {
        const detail = await getPautaDetailAction(result.id);
        if (detail) onCreated(detail.pauta);
      }
    });
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {controlled ? null : (
        <DialogTrigger asChild>
          {props.trigger ?? (
            <Button>
              <Plus aria-hidden />
              Nova pauta
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Nova pauta.</DialogTitle>
          <DialogDescription>Toda pauta pertence a um projeto.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {error ? <Alert variant="error">{error}</Alert> : null}

          {lockedProjectId ? null : (
            <FormField id="pauta-project" label="Projeto" error={errors.projectId?.message}>
              <Controller
                control={control}
                name="projectId"
                render={({ field }) => (
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <SelectTrigger id="pauta-project" aria-invalid={!!errors.projectId}>
                      <SelectValue placeholder="Selecione o projeto" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          )}

          <FormField id="pauta-title" label="Título" error={errors.title?.message}>
            <Input id="pauta-title" aria-invalid={!!errors.title} {...register("title")} />
          </FormField>

          <FormField id="pauta-briefing" label="Briefing" hint="Opcional." error={errors.briefing?.message}>
            <Textarea id="pauta-briefing" {...register("briefing")} />
          </FormField>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField id="pauta-lead" label="Líder" error={errors.leadId?.message}>
              <Controller
                control={control}
                name="leadId"
                render={({ field }) => <OwnerSelect id="pauta-lead" value={field.value} onChange={field.onChange} members={options.members} invalid={!!errors.leadId} />}
              />
            </FormField>
            <FormField id="pauta-priority" label="Prioridade">
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="pauta-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((item) => (
                        <SelectItem key={item} value={item}>
                          {PRIORITY_LABELS[item]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </FormField>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-3">
            <Label htmlFor="pauta-critical" className="cursor-pointer">
              Pauta crítica
            </Label>
            <Controller control={control} name="isCritical" render={({ field }) => <Switch id="pauta-critical" checked={field.value} onCheckedChange={field.onChange} />} />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Tipo de captação</legend>
            <div className="flex gap-4">
              {PAUTA_CAPTURE_TYPES.map((item) => (
                <Controller
                  key={item}
                  control={control}
                  name="captureType"
                  render={({ field }) => {
                    const id = `pauta-capture-${item}`;
                    const checked = field.value.includes(item);
                    return (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={id}
                          checked={checked}
                          onCheckedChange={(next) => field.onChange(next ? [...field.value, item] : field.value.filter((v) => v !== item))}
                        />
                        <Label htmlFor={id} className="cursor-pointer font-normal">
                          {PAUTA_CAPTURE_TYPE_LABELS[item]}
                        </Label>
                      </div>
                    );
                  }}
                />
              ))}
            </div>
          </fieldset>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField id="pauta-format" label="Formato" hint="Ex.: Vertical, Horizontal." error={errors.format?.message}>
              <Input id="pauta-format" {...register("format")} />
            </FormField>
            <FormField id="pauta-location" label="Local" error={errors.locationAddress?.message}>
              <Input id="pauta-location" {...register("locationAddress")} />
            </FormField>
            <FormField id="pauta-scheduled-date" label="Data da captação" error={errors.scheduledDate?.message}>
              <Input id="pauta-scheduled-date" type="date" {...register("scheduledDate")} />
            </FormField>
            <FormField id="pauta-scheduled-time" label="Horário" error={errors.scheduledTime?.message}>
              <Input id="pauta-scheduled-time" type="time" {...register("scheduledTime")} />
            </FormField>
            <FormField id="pauta-duration" label="Duração (min)" hint="Opcional." error={errors.durationMinutes?.message}>
              <Input id="pauta-duration" inputMode="numeric" {...register("durationMinutes")} />
            </FormField>
            <FormField id="pauta-due" label="Prazo" error={errors.dueDate?.message}>
              <Input id="pauta-due" type="date" {...register("dueDate")} />
            </FormField>
          </div>

          <FormField id="pauta-contact" label="Contato" hint="Opcional.">
            <Controller
              control={control}
              name="contactId"
              render={({ field }) => (
                <Select value={field.value || NO_CONTACT} onValueChange={(value) => field.onChange(value === NO_CONTACT ? "" : value)} disabled={!projectId}>
                  <SelectTrigger id="pauta-contact">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CONTACT}>Sem contato definido</SelectItem>
                    {projectContacts.map((contact) => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </FormField>

          <FormField id="pauta-drive" label="Pasta do Drive" hint="Opcional." error={errors.driveFolderUrl?.message}>
            <Input id="pauta-drive" placeholder="https://drive.google.com/…" {...register("driveFolderUrl")} />
          </FormField>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" loading={pending}>
              Criar pauta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
