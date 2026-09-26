"use client";

import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Switch } from "@/components/ui/switch";
import { saveAnnouncementAction } from "@/features/announcements/actions";
import { announcementSchema, type AnnouncementValues } from "@/features/announcements/schemas";
import type { AnnouncementItem } from "@/features/announcements/types";
import { ORG_LEVELS, ORG_LEVEL_LABELS } from "@/lib/auth/org";
import { SQUADS, SQUAD_LABELS } from "@/lib/auth/squads";
import { dateInAppZone, timeInAppZone, todayInAppZone } from "@/lib/calendar";

interface AnnouncementFormDialogProps {
  item?: AnnouncementItem;
  onOpenChange: (open: boolean) => void;
}

function defaults(item?: AnnouncementItem): AnnouncementValues {
  if (item) {
    return {
      title: item.title,
      body: item.body,
      publishDate: dateInAppZone(item.published_at),
      publishTime: timeInAppZone(item.published_at),
      expiresDate: item.expires_at ? dateInAppZone(item.expires_at) : "",
      expiresTime: item.expires_at ? timeInAppZone(item.expires_at) : "",
      audienceSquads: item.audience_squads,
      audienceLevels: item.audience_levels,
      isPinned: item.is_pinned,
    };
  }
  return {
    title: "",
    body: "",
    publishDate: todayInAppZone(),
    publishTime: timeInAppZone(new Date().toISOString()),
    expiresDate: "",
    expiresTime: "",
    audienceSquads: [],
    audienceLevels: [],
    isPinned: false,
  };
}

function toggle<T extends string>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

/** "Novo aviso" / editar: texto rico, agendamento (publicação e encerramento) e público. Só diretoria/master. */
export function AnnouncementFormDialog({ item, onOpenChange }: AnnouncementFormDialogProps) {
  const [pending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<AnnouncementValues>({ resolver: zodResolver(announcementSchema), defaultValues: defaults(item) });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = await saveAnnouncementAction(values, item?.id);
      if (result.ok) {
        toast.success(result.message);
        onOpenChange(false);
      } else toast.error(result.error);
    });
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{item ? "Editar aviso." : "Novo aviso."}</DialogTitle>
          <DialogDescription>Quem estiver no público recebe uma notificação quando o aviso for publicado.</DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} noValidate className="space-y-5">
          <FormField id="aviso-titulo" label="Título" error={errors.title?.message}>
            <Input id="aviso-titulo" aria-invalid={!!errors.title} {...register("title")} />
          </FormField>

          <FormField id="aviso-texto" label="Texto" error={errors.body?.message}>
            <Controller
              control={control}
              name="body"
              render={({ field }) => (
                <RichTextEditor
                  id="aviso-texto"
                  value={field.value}
                  onChange={field.onChange}
                  invalid={!!errors.body}
                  describedBy={errors.body ? "aviso-texto-message" : undefined}
                  placeholder="Use **negrito**, *itálico*, listas com - e links [texto](https://…)."
                />
              )}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <fieldset className="space-y-2">
              <legend className="eyebrow mb-2">Publicação</legend>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Input type="date" aria-label="Data de publicação" aria-invalid={!!errors.publishDate} {...register("publishDate")} />
                <Input type="time" aria-label="Hora de publicação" className="w-28" {...register("publishTime")} />
              </div>
              {errors.publishDate ? <p className="text-[13px] font-semibold">{errors.publishDate.message}</p> : null}
            </fieldset>
            <fieldset className="space-y-2">
              <legend className="eyebrow mb-2">Encerramento (opcional)</legend>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <Input type="date" aria-label="Data de encerramento" aria-invalid={!!errors.expiresDate} {...register("expiresDate")} />
                <Input type="time" aria-label="Hora de encerramento" className="w-28" {...register("expiresTime")} />
              </div>
              {errors.expiresDate ? <p className="text-[13px] font-semibold">{errors.expiresDate.message}</p> : null}
            </fieldset>
          </div>

          <Controller
            control={control}
            name="audienceSquads"
            render={({ field }) => (
              <fieldset className="space-y-2">
                <legend className="eyebrow mb-2">Squads (nenhum marcado = todos)</legend>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {SQUADS.map((squad) => (
                    <label key={squad} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={field.value.includes(squad)} onCheckedChange={() => field.onChange(toggle(field.value, squad))} />
                      {SQUAD_LABELS[squad]}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          />

          <Controller
            control={control}
            name="audienceLevels"
            render={({ field }) => (
              <fieldset className="space-y-2">
                <legend className="eyebrow mb-2">Níveis (nenhum marcado = todos)</legend>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {ORG_LEVELS.map((level) => (
                    <label key={level} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={field.value.includes(level)} onCheckedChange={() => field.onChange(toggle(field.value, level))} />
                      {ORG_LEVEL_LABELS[level]}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          />

          <Controller
            control={control}
            name="isPinned"
            render={({ field }) => (
              <div className="flex items-center gap-3">
                <Switch id="aviso-fixado" checked={field.value} onCheckedChange={field.onChange} />
                <Label htmlFor="aviso-fixado" className="font-normal">
                  Fixar no topo da lista
                </Label>
              </div>
            )}
          />

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              {item ? "Salvar" : "Publicar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
