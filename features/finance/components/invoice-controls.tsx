"use client";

import { useRef, useState, useTransition } from "react";
import { ExternalLink, FileText, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { attachReceivableInvoiceAction, getInvoiceFileUrlAction } from "@/features/finance/actions";
import { INVOICE_FILE_ACCEPT, uploadInvoiceFile } from "@/features/finance/invoice-files";
import { InvoiceFilePreview } from "@/components/drive/invoice-file-preview";
import { buildInvoiceFile } from "@/lib/invoice-file";
import { NFSE_EMISSOR_URL } from "@/lib/links";
import type { ActionResult } from "@/types";

/** Abre o Emissor Nacional da NFS-e (MEI) em nova aba. */
export function NfseEmitButton({ size = "sm", variant = "secondary", label = "Emitir NFS-e", className }: Pick<ButtonProps, "size" | "variant" | "className"> & { label?: string }) {
  return (
    <Button asChild size={size} variant={variant} className={className}>
      <a href={NFSE_EMISSOR_URL} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}>
        <ExternalLink aria-hidden />
        {label}
      </a>
    </Button>
  );
}

/** Botão que abre o arquivo da nota (link assinado de 5 minutos). */
export function InvoiceFileButton({ path, label = "Ver nota", size = "sm", variant = "ghost" }: { path: string; label?: string } & Pick<ButtonProps, "size" | "variant">) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      loading={pending}
      onClick={(event) => {
        event.stopPropagation();
        // Abre a aba já no clique (bloqueadores de pop-up), depois aponta para o link assinado.
        const tab = window.open("about:blank", "_blank");
        startTransition(async () => {
          const result = await getInvoiceFileUrlAction(path);
          if (result.ok && tab) tab.location.href = result.url;
          else {
            tab?.close();
            toast.error(result.ok ? "O navegador bloqueou a nova aba." : result.error);
          }
        });
      }}
    >
      <FileText aria-hidden />
      {label}
    </Button>
  );
}

interface AttachInvoiceDialogProps {
  title: string;
  description: string;
  /** Pasta no bucket: "receivables/<id>" ou "issuances/<id>". */
  folder: string;
  initialNumber?: string | null;
  /** Já existe arquivo: o envio passa a ser opcional (só troca se escolher outro). */
  hasFile?: boolean;
  onSave: (input: { filePath: string | null; invoiceNumber: string }) => Promise<ActionResult>;
  onOpenChange: (open: boolean) => void;
  /** Cliente e mês (competência ou vencimento): mostra onde salvar o PDF no Drive e com que nome. */
  driveFile?: { clientName: string; month: string };
}

/**
 * Anexar a nota fiscal: o caminho é emitir no Emissor Nacional (botão aqui mesmo), baixar o PDF/XML
 * e enviar o arquivo com o número da nota.
 */
export function AttachInvoiceDialog({ title, description, folder, initialNumber, hasFile = false, onSave, onOpenChange, driveFile }: AttachInvoiceDialogProps) {
  const [number, setNumber] = useState(initialNumber ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  function save() {
    startTransition(async () => {
      try {
        const filePath = file ? await uploadInvoiceFile(folder, file) : null;
        const result = await onSave({ filePath, invoiceNumber: number.trim() });
        if (result.ok) {
          toast.success(result.message);
          onOpenChange(false);
        } else toast.error(result.error);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Falha no envio.");
      }
    });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <ol className="space-y-4 text-sm">
          <li className="space-y-2">
            <p className="font-semibold">1. Emita a nota no Emissor Nacional (MEI)</p>
            <NfseEmitButton label="Abrir o Emissor Nacional" />
          </li>
          <li className="space-y-2">
            <p className="font-semibold">2. Anexe o arquivo baixado (PDF ou XML)</p>
            {driveFile ? (
              <div className="space-y-1.5 rounded-md border border-border p-3">
                <p className="text-[12px] text-muted-foreground">Renomeie e salve também no Drive:</p>
                <InvoiceFilePreview file={buildInvoiceFile(driveFile)} />
              </div>
            ) : null}
            <input ref={input} type="file" accept={INVOICE_FILE_ACCEPT} className="sr-only" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" variant="secondary" size="sm" onClick={() => input.current?.click()}>
                <Paperclip aria-hidden />
                {file ? "Trocar arquivo" : hasFile ? "Substituir arquivo" : "Escolher arquivo"}
              </Button>
              <span className="min-w-0 truncate text-[13px] text-muted-foreground">
                {file ? file.name : hasFile ? "Já há um arquivo anexado." : "Nenhum arquivo escolhido."}
              </span>
            </div>
          </li>
          <li>
            <FormField id="nf-number" label="3. Número da nota">
              <Input id="nf-number" value={number} maxLength={60} onChange={(event) => setNumber(event.target.value)} placeholder="Ex.: 154" />
            </FormField>
          </li>
        </ol>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={save} loading={pending} disabled={!file && !hasFile && !number.trim()}>
            Salvar nota
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Atalho compacto para o Emissor Nacional dentro de cards clicáveis/arrastáveis (pautas de nota
 * fiscal): não abre o card nem inicia o arraste.
 */
export function NfseChip() {
  return (
    <a
      href={NFSE_EMISSOR_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      className="inline-flex items-center gap-1 rounded-full border border-border-strong px-2 py-0.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
    >
      <ExternalLink className="size-3" aria-hidden />
      Emitir NFS-e
    </a>
  );
}

/** Pauta automática de nota fiscal: registra o número da nota direto no recebimento. */
function InvoiceNumberQuickSave({ receivableId }: { receivableId: string }) {
  const [number, setNumber] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex w-full flex-wrap items-end gap-2 border-t border-border pt-3"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          const result = await attachReceivableInvoiceAction(receivableId, { invoiceNumber: number, filePath: null });
          if (result.ok) {
            toast.success("Número da nota registrado no recebimento.");
            setNumber("");
          } else toast.error(result.error);
        });
      }}
    >
      <FormField id="pauta-nf-number" label="Nota emitida? Registre o número no recebimento" className="min-w-[12rem] flex-1">
        <Input id="pauta-nf-number" value={number} maxLength={60} onChange={(event) => setNumber(event.target.value)} placeholder="Ex.: 154" />
      </FormField>
      <Button type="submit" size="sm" loading={pending} disabled={!number.trim()}>
        Salvar número
      </Button>
    </form>
  );
}

/** Dentro de uma pauta/tarefa de nota fiscal: atalho para emitir e onde anexar depois. */
export function InvoiceTaskCallout({ projectId, receivableId }: { projectId?: string | null; receivableId?: string | null }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border-strong bg-surface-raised p-3">
      <p className="min-w-0 flex-1 text-[13px] text-muted-foreground">
        Tarefa de nota fiscal: emita no Emissor Nacional e anexe o arquivo{" "}
        {projectId ? (
          <a href={`/projetos/${projectId}#nota-fiscal`} className="font-semibold text-foreground underline underline-offset-2">
            no card Nota fiscal do projeto
          </a>
        ) : (
          "no recebimento (Financeiro → Recebimentos → ⋯ → Anexar nota fiscal)"
        )}
        .
      </p>
      <NfseEmitButton />
      {receivableId ? <InvoiceNumberQuickSave receivableId={receivableId} /> : null}
    </div>
  );
}
