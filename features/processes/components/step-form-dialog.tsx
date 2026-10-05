"use client";

import { useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { saveStepAction } from "@/features/processes/actions";
import { CREDENTIAL_WARNING, hasCredential, SAFE_ACCESS_TEXT } from "@/features/processes/credentials";
import { stepSchema, type StepValues } from "@/features/processes/schemas";
import { STEP_TOOL_LABELS, STEP_TOOLS, SYSTEM_AREA_LABELS, SYSTEM_AREAS, type ProcessStepItem } from "@/features/processes/types";

interface StepFormDialogProps {
  processId: string;
  step?: ProcessStepItem;
  onOpenChange: (open: boolean) => void;
}

/** Adicionar/editar um passo. Credenciais são barradas aqui (e de novo no banco). */
export function StepFormDialog({ processId, step, onOpenChange }: StepFormDialogProps) {
  const [pending, startTransition] = useTransition();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<StepValues>({
    resolver: zodResolver(stepSchema),
    defaultValues: {
      title: step?.title ?? "",
      description: step?.description ?? "",
      responsibleRole: step?.responsibleRole ?? "",
      systemArea: step?.systemArea ?? "nenhum",
      systemLink: step?.systemLink ?? "",
      doneCriteria: step?.doneCriteria ?? "",
      estimatedMinutes: step?.estimatedMinutes ? String(step.estimatedMinutes) : "",
      isBlocking: step?.isBlocking ?? false,
      tool: step?.tool ?? "",
    },
  });

  // Aviso ao vivo: a pessoa vê o problema antes de tentar salvar.
  const watched = useWatch({ control, name: ["title", "description", "responsibleRole", "systemLink", "doneCriteria"] });
  const leaking = watched.some((value) => hasCredential(value));

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = await saveStepAction(processId, values, step?.id);
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
          <DialogTitle>{step ? "Editar passo." : "Novo passo."}</DialogTitle>
          <DialogDescription>Quem faz, onde no sistema e como saber que terminou.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {leaking ? (
            <Alert variant="error" title="Credencial detectada.">
              <span className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {CREDENTIAL_WARNING}
              </span>
            </Alert>
          ) : null}

          <FormField id="step-title" label="Título" error={errors.title?.message}>
            <Input id="step-title" aria-invalid={!!errors.title} {...register("title")} />
          </FormField>

          <FormField id="step-description" label="Como fazer" hint={`Acesso a sistema externo: escreva “${SAFE_ACCESS_TEXT}”.`} error={errors.description?.message}>
            <Controller
              control={control}
              name="description"
              render={({ field }) => (
                <RichTextEditor
                  id="step-description"
                  value={field.value}
                  onChange={field.onChange}
                  invalid={!!errors.description}
                  describedBy="step-description-message"
                  placeholder="Use **negrito** e listas com - para o passo a passo."
                />
              )}
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="step-role" label="Cargo responsável" error={errors.responsibleRole?.message}>
              <Input id="step-role" aria-invalid={!!errors.responsibleRole} {...register("responsibleRole")} />
            </FormField>
            <FormField id="step-minutes" label="Tempo estimado (min)" error={errors.estimatedMinutes?.message}>
              <Input id="step-minutes" inputMode="numeric" aria-invalid={!!errors.estimatedMinutes} {...register("estimatedMinutes")} />
            </FormField>
            <FormField id="step-area" label="Onde no sistema">
              <NativeSelect id="step-area" {...register("systemArea")}>
                {SYSTEM_AREAS.map((area) => (
                  <option key={area} value={area}>
                    {SYSTEM_AREA_LABELS[area]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="step-link" label="Link (opcional)" hint="Rota do sistema (/financeiro) ou https://" error={errors.systemLink?.message}>
              <Input id="step-link" aria-invalid={!!errors.systemLink} {...register("systemLink")} />
            </FormField>
          </div>

          <FormField id="step-done" label="Como saber que terminou" error={errors.doneCriteria?.message}>
            <Textarea id="step-done" rows={2} aria-invalid={!!errors.doneCriteria} {...register("doneCriteria")} />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="step-tool" label="Ferramenta no passo">
              <NativeSelect id="step-tool" {...register("tool")}>
                <option value="">Nenhuma</option>
                {STEP_TOOLS.map((tool) => (
                  <option key={tool} value={tool}>
                    {STEP_TOOL_LABELS[tool]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <Controller
              control={control}
              name="isBlocking"
              render={({ field }) => (
                <div className="flex items-start gap-3 sm:pt-7">
                  <Switch id="step-blocking" checked={field.value} onCheckedChange={field.onChange} className="mt-0.5" />
                  <Label htmlFor="step-blocking" className="font-normal leading-snug">
                    Obrigatório
                    <span className="block text-[13px] text-muted-foreground">Não seguir sem concluir este passo.</span>
                  </Label>
                </div>
              )}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={pending} disabled={leaking}>
              {step ? "Salvar passo" : "Adicionar passo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
