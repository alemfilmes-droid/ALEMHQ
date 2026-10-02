"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Presentation, X } from "lucide-react";
import { toast } from "sonner";
import { savePresentationAction } from "@/features/budgets/actions";
import { PROPOSAL_TEMPLATE_INFO, PROPOSAL_TEMPLATES, type PresentationContent, type ProposalTemplate } from "@/features/budgets/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { describeUploadError, IMAGE_ACCEPT, IMAGE_TYPES, validateImage } from "@/lib/uploads";
import { cn } from "@/lib/utils";

const ACCENT_PRESETS = ["#E5231B", "#F0F0F0", "#D9A62E", "#2E9E6B", "#3B82F6", "#8B5CF6"];

async function uploadAsset(budgetId: string, file: File): Promise<string> {
  const problem = validateImage(file);
  if (problem) throw new Error(problem);
  const supabase = createClient();
  const path = `${budgetId}/${crypto.randomUUID()}.${IMAGE_TYPES[file.type]}`;
  const { error } = await supabase.storage.from("budget-assets").upload(path, file, { contentType: file.type });
  if (error) throw new Error(describeUploadError(error));
  return supabase.storage.from("budget-assets").getPublicUrl(path).data.publicUrl;
}

function linesToList(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

interface PresentationDialogProps {
  budgetId: string;
  initial: PresentationContent;
  companyLogoUrl: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Salva o orçamento antes (valores atualizados na apresentação). */
  beforeOpen: () => Promise<boolean>;
}

/**
 * Personalização da apresentação comercial: modelo (3 estruturas), cor da IDV, logo do cliente,
 * textos do projeto e imagens de referência. Ao gerar, abre a apresentação pronta para PDF.
 */
export function PresentationDialog({ budgetId, initial, companyLogoUrl, open, onOpenChange, beforeOpen }: PresentationDialogProps) {
  const [content, setContent] = useState<PresentationContent>({ ...initial, clientLogoUrl: initial.clientLogoUrl || companyLogoUrl || "" });
  const [deliverables, setDeliverables] = useState(initial.deliverables.join("\n"));
  const [timeline, setTimeline] = useState(initial.timeline.map((item) => `${item.step} | ${item.when}`).join("\n"));
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const logoInput = useRef<HTMLInputElement>(null);
  const refsInput = useRef<HTMLInputElement>(null);

  function set<K extends keyof PresentationContent>(key: K, value: PresentationContent[K]) {
    setContent((current) => ({ ...current, [key]: value }));
  }

  async function onLogo(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      set("clientLogoUrl", await uploadAsset(budgetId, file));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no envio.");
    } finally {
      setUploading(false);
    }
  }

  async function onReferences(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, 8 - content.references.length)) urls.push(await uploadAsset(budgetId, file));
      set("references", [...content.references, ...urls]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha no envio.");
    } finally {
      setUploading(false);
    }
  }

  function generate() {
    const payload: PresentationContent = {
      ...content,
      deliverables: linesToList(deliverables).slice(0, 20),
      timeline: linesToList(timeline)
        .slice(0, 12)
        .map((line) => {
          const [step, ...rest] = line.split("|");
          return { step: (step ?? "").trim().slice(0, 120), when: rest.join("|").trim().slice(0, 60) };
        }),
    };
    startTransition(async () => {
      if (!(await beforeOpen())) return;
      const result = await savePresentationAction(budgetId, payload);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      window.open(`/orcamentos/${budgetId}/apresentacao`, "_blank", "noopener");
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle>Apresentação comercial.</DialogTitle>
          <DialogDescription>Escolha o modelo, a cor da IDV e o conteúdo deste projeto. Os valores entram resumidos no fim, sem custos internos.</DialogDescription>
        </DialogHeader>

        <div className="-mx-1.5 min-h-0 flex-1 space-y-6 overflow-y-auto px-1.5">
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-semibold">Modelo</legend>
            <div className="grid gap-3 md:grid-cols-3">
              {PROPOSAL_TEMPLATES.map((template: ProposalTemplate) => {
                const info = PROPOSAL_TEMPLATE_INFO[template];
                const active = content.template === template;
                return (
                  <button
                    key={template}
                    type="button"
                    onClick={() => set("template", template)}
                    aria-pressed={active}
                    className={cn(
                      "rounded-lg border p-3 text-left transition-colors",
                      active ? "border-foreground bg-surface-raised" : "border-border hover:bg-surface-hover",
                    )}
                  >
                    <span className="block text-sm font-bold">{info.name}</span>
                    <span className="mt-1 block text-[12px] leading-snug text-muted-foreground">{info.description}</span>
                    <span className="mt-2 block text-[11px] leading-snug text-subtle">{info.flow.join(" → ")}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-5 md:grid-cols-2">
            <FormField id="pres-accent" label="Cor de destaque (IDV)" hint="O vermelho da Além, ou a cor do cliente.">
              <div className="flex flex-wrap items-center gap-2">
                {ACCENT_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => set("accent", color)}
                    aria-label={`Cor ${color}`}
                    aria-pressed={content.accent.toLowerCase() === color.toLowerCase()}
                    className={cn("size-8 rounded-full border-2", content.accent.toLowerCase() === color.toLowerCase() ? "border-foreground" : "border-transparent")}
                    style={{ background: color }}
                  />
                ))}
                <input
                  id="pres-accent"
                  type="color"
                  value={content.accent}
                  onChange={(event) => set("accent", event.target.value)}
                  className="h-8 w-12 cursor-pointer rounded border border-border bg-transparent"
                  aria-label="Outra cor"
                />
              </div>
            </FormField>
            <FormField id="pres-logo" label="Logo do cliente">
              <div className="flex items-center gap-3">
                {content.clientLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- prévia do logo enviado
                  <img src={content.clientLogoUrl} alt="Logo do cliente" className="size-12 rounded-md border border-border bg-white object-contain p-1" />
                ) : (
                  <span className="flex size-12 items-center justify-center rounded-md border border-dashed border-border-strong text-[11px] text-subtle">sem logo</span>
                )}
                <Button type="button" size="sm" variant="secondary" onClick={() => logoInput.current?.click()} loading={uploading}>
                  <ImagePlus aria-hidden />
                  Enviar logo
                </Button>
                {content.clientLogoUrl ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => set("clientLogoUrl", "")}>
                    Remover
                  </Button>
                ) : null}
                <input ref={logoInput} type="file" accept={IMAGE_ACCEPT} hidden onChange={(event) => void onLogo(event.target.files?.[0])} />
              </div>
            </FormField>
          </div>

          <FormField id="pres-context" label="Contexto / desafio do cliente">
            <Textarea id="pres-context" rows={3} value={content.context} onChange={(event) => set("context", event.target.value)} />
          </FormField>
          <FormField id="pres-objective" label="Objetivo do projeto">
            <Textarea id="pres-objective" rows={2} value={content.objective} onChange={(event) => set("objective", event.target.value)} />
          </FormField>
          <FormField id="pres-concept" label="Ideia / conceito criativo">
            <Textarea id="pres-concept" rows={3} value={content.concept} onChange={(event) => set("concept", event.target.value)} />
          </FormField>
          {content.template === "tratamento" ? (
            <FormField id="pres-narrative" label="Narrativa (como o filme se desenvolve)" hint="Ex.: abertura, desenvolvimento, virada, final.">
              <Textarea id="pres-narrative" rows={4} value={content.narrative} onChange={(event) => set("narrative", event.target.value)} />
            </FormField>
          ) : null}
          <div className="grid gap-5 md:grid-cols-2">
            <FormField id="pres-deliverables" label="Entregáveis" hint="Um por linha. Ex.: 1 filme de 60s.">
              <Textarea id="pres-deliverables" rows={5} value={deliverables} onChange={(event) => setDeliverables(event.target.value)} />
            </FormField>
            <FormField id="pres-timeline" label="Cronograma" hint="Um por linha: etapa | quando. Ex.: Captação | 10/09">
              <Textarea id="pres-timeline" rows={5} value={timeline} onChange={(event) => setTimeline(event.target.value)} />
            </FormField>
          </div>

          <FormField id="pres-refs" label="Referências visuais" hint="Até 8 imagens (moodboard, frames de referência).">
            <div className="space-y-3">
              {content.references.length > 0 ? (
                <ul className="grid grid-cols-4 gap-2">
                  {content.references.map((url) => (
                    <li key={url} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element -- prévia da referência enviada */}
                      <img src={url} alt="" className="aspect-video w-full rounded-md border border-border object-cover" />
                      <button
                        type="button"
                        onClick={() => set("references", content.references.filter((item) => item !== url))}
                        className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"
                        aria-label="Remover referência"
                      >
                        <X className="size-3" aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              {content.references.length < 8 ? (
                <Button type="button" size="sm" variant="secondary" onClick={() => refsInput.current?.click()} loading={uploading}>
                  <ImagePlus aria-hidden />
                  Adicionar imagens
                </Button>
              ) : null}
              <input ref={refsInput} type="file" accept={IMAGE_ACCEPT} multiple hidden onChange={(event) => void onReferences(event.target.files)} />
            </div>
          </FormField>

          <FormField id="pres-closing" label="Mensagem de encerramento" hint="Opcional.">
            <Input id="pres-closing" value={content.closing} onChange={(event) => set("closing", event.target.value)} />
          </FormField>
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={generate} loading={pending} disabled={uploading}>
            <Presentation aria-hidden />
            Gerar apresentação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
