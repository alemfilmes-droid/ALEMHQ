"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveProcessAction } from "@/features/processes/actions";
import { processSchema, type ProcessValues } from "@/features/processes/schemas";
import { FREQUENCY_LABELS, PROCESS_FREQUENCIES, type ProcessDetail } from "@/features/processes/types";
import { SQUAD_LABELS } from "@/lib/auth/squads";
import type { Squad } from "@/types";

interface ProcessFormDialogProps {
  process?: ProcessDetail;
  /** Squads em que a pessoa pode criar/editar. */
  squads: Squad[];
  onOpenChange: (open: boolean) => void;
}

/** Criar/editar um fluxograma: dados do processo (os passos são editados na página dele). */
export function ProcessFormDialog({ process, squads, onOpenChange }: ProcessFormDialogProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<ProcessValues>({
    resolver: zodResolver(processSchema),
    defaultValues: {
      title: process?.title ?? "",
      squad: process?.squad ?? squads[0] ?? "diretoria",
      summary: process?.summary ?? "",
      triggerDescription: process?.triggerDescription ?? "",
      frequency: process?.frequency ?? "sob_demanda",
      ownerRole: process?.ownerRole ?? "",
      isPublished: process?.isPublished ?? true,
    },
  });

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = await saveProcessAction(values, process?.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      onOpenChange(false);
      if (!process && result.slug) router.push(`/fluxogramas/${result.slug}`);
    });
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{process ? "Editar fluxograma." : "Novo fluxograma."}</DialogTitle>
          <DialogDescription>O processo como ele é feito na Além. Os passos vêm depois, na página do fluxograma.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <FormField id="proc-title" label="Título" error={errors.title?.message}>
            <Input id="proc-title" aria-invalid={!!errors.title} {...register("title")} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="proc-squad" label="Squad" error={errors.squad?.message}>
              <NativeSelect id="proc-squad" {...register("squad")}>
                {squads.map((squad) => (
                  <option key={squad} value={squad}>
                    {SQUAD_LABELS[squad]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="proc-frequency" label="Frequência">
              <NativeSelect id="proc-frequency" {...register("frequency")}>
                {PROCESS_FREQUENCIES.map((frequency) => (
                  <option key={frequency} value={frequency}>
                    {FREQUENCY_LABELS[frequency]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          </div>
          <FormField id="proc-trigger" label="O que inicia este processo" hint="Ex.: parcela próxima do vencimento." error={errors.triggerDescription?.message}>
            <Input id="proc-trigger" aria-invalid={!!errors.triggerDescription} {...register("triggerDescription")} />
          </FormField>
          <FormField id="proc-owner" label="Cargo responsável" hint="Ex.: Auxiliar financeiro, SDR, Head de Audiovisual." error={errors.ownerRole?.message}>
            <Input id="proc-owner" aria-invalid={!!errors.ownerRole} {...register("ownerRole")} />
          </FormField>
          <FormField id="proc-summary" label="Resumo" error={errors.summary?.message}>
            <Textarea id="proc-summary" rows={3} aria-invalid={!!errors.summary} {...register("summary")} />
          </FormField>
          <Controller
            control={control}
            name="isPublished"
            render={({ field }) => (
              <div className="flex items-start gap-3">
                <Switch id="proc-published" checked={field.value} onCheckedChange={field.onChange} className="mt-0.5" />
                <Label htmlFor="proc-published" className="font-normal leading-snug">
                  Publicado
                  <span className="block text-[13px] text-muted-foreground">Desligado = rascunho: só a liderança do squad vê.</span>
                </Label>
              </div>
            )}
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              {process ? "Salvar" : "Criar fluxograma"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
