"use client";

import { useRef, useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ImagePlus, ShieldAlert, Trash2 } from "lucide-react";
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
import {
  ACTION_KIND_LABELS,
  ACTION_KINDS,
  STEP_TOOL_LABELS,
  STEP_TOOLS,
  STEP_TYPE_LABELS,
  STEP_TYPES,
  SYSTEM_AREA_LABELS,
  SYSTEM_AREAS,
  type ProcessStepItem,
} from "@/features/processes/types";
import { createClient } from "@/lib/supabase/client";
import { describeUploadError, IMAGE_ACCEPT, IMAGE_TYPES, validateImage } from "@/lib/uploads";

interface StepFormDialogProps {
  processId: string;
  step?: ProcessStepItem;
  /** Passos do processo (para as saídas Sim/Não de uma decisão). */
  steps: ProcessStepItem[];
  onOpenChange: (open: boolean) => void;
}

/** Envia a imagem ilustrativa para o bucket público "process-assets" (pasta = id do processo). */
async function uploadStepImage(processId: string, file: File): Promise<string> {
  const problem = validateImage(file);
  if (problem) throw new Error(problem);
  const supabase = createClient();
  const path = `${processId}/${crypto.randomUUID()}.${IMAGE_TYPES[file.type]}`;
  const { error } = await supabase.storage.from("process-assets").upload(path, file, { contentType: file.type });
  if (error) throw new Error(describeUploadError(error));
  return supabase.storage.from("process-assets").getPublicUrl(path).data.publicUrl;
}

/** Adicionar/editar um passo. Credenciais são barradas aqui (e de novo no banco). */
export function StepFormDialog({ processId, step, steps, onOpenChange }: StepFormDialogProps) {
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const imageInput = useRef<HTMLInputElement>(null);
  const {
    register,
    control,
    handleSubmit,
    setValue,
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
      stepType: step?.stepType ?? "acao",
      actionKind: step?.actionKind ?? "executar",
      branchYesStepId: step?.branchYesStepId ?? "",
      branchNoStepId: step?.branchNoStepId ?? "",
      imageUrl: step?.imageUrl ?? "",
      exampleText: step?.exampleText ?? "",
    },
  });
  const [stepType, imageUrl] = useWatch({ control, name: ["stepType", "imageUrl"] });
  const others = steps.filter((item) => item.id !== step?.id);

  async function onImage(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      setValue("imageUrl", await uploadStepImage(processId, file), { shouldDirty: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no envio.");
    } finally {
      setUploading(false);
    }
  }

  // Aviso ao vivo: a pessoa vê o problema antes de tentar salvar.
  const watched = useWatch({ control, name: ["title", "description", "responsibleRole", "systemLink", "doneCriteria", "exampleText"] });
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

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="step-type" label="Tipo do passo">
              <NativeSelect id="step-type" {...register("stepType")}>
                {STEP_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {STEP_TYPE_LABELS[type]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="step-kind" label="Ícone (tipo de ação)">
              <NativeSelect id="step-kind" {...register("actionKind")}>
                {ACTION_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {ACTION_KIND_LABELS[kind]}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            {stepType === "decisao" ? (
              <>
                <FormField id="step-yes" label="Se “Sim”, vai para" error={errors.branchYesStepId?.message}>
                  <NativeSelect id="step-yes" {...register("branchYesStepId")}>
                    <option value="">Escolha o passo…</option>
                    {others.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.orderIndex}. {item.title}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
                <FormField id="step-no" label="Se “Não”, vai para" error={errors.branchNoStepId?.message}>
                  <NativeSelect id="step-no" aria-invalid={!!errors.branchNoStepId} {...register("branchNoStepId")}>
                    <option value="">Escolha o passo…</option>
                    {others.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.orderIndex}. {item.title}
                      </option>
                    ))}
                  </NativeSelect>
                </FormField>
              </>
            ) : null}
          </div>

          <FormField id="step-example" label="Exemplo (opcional)" hint="Valores de exemplo, ex.: o nome exato de um arquivo." error={errors.exampleText?.message}>
            <Textarea id="step-example" rows={2} className="font-mono text-[13px]" aria-invalid={!!errors.exampleText} {...register("exampleText")} />
          </FormField>

          <div className="space-y-2">
            <p className="text-sm font-semibold">Imagem ilustrativa (opcional)</p>
            <input ref={imageInput} type="file" accept={IMAGE_ACCEPT} className="sr-only" onChange={(event) => void onImage(event.target.files?.[0])} />
            {imageUrl ? (
              <div className="flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- prévia da imagem enviada */}
                <img src={imageUrl} alt="" className="max-h-32 rounded-md border border-border object-contain" />
                <Button type="button" size="sm" variant="ghost" onClick={() => setValue("imageUrl", "", { shouldDirty: true })}>
                  <Trash2 aria-hidden />
                  Remover
                </Button>
              </div>
            ) : (
              <Button type="button" size="sm" variant="secondary" loading={uploading} onClick={() => imageInput.current?.click()}>
                <ImagePlus aria-hidden />
                Enviar imagem (até 5 MB)
              </Button>
            )}
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
            <Button type="submit" loading={pending} disabled={leaking || uploading}>
              {step ? "Salvar passo" : "Adicionar passo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
