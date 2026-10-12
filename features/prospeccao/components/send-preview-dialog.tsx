"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Phone } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { SHEET_ON_MOBILE } from "@/features/prospeccao/components/sheet";
import { WhatsAppBubble } from "@/features/prospeccao/components/whatsapp-bubble";
import { WhatsAppIcon } from "@/features/prospeccao/components/whatsapp-icon";
import { prepareSendAction, type PrepareResult } from "@/features/prospeccao/send-actions";
import { DEFAULT_DDD } from "@/lib/prospeccao/phone";
import { checkFinalText, whatsappUrl } from "@/lib/prospeccao/message";

/** Celular abre o app na mesma aba; computador abre o WhatsApp Web em outra aba. */
function opensInSameTab(): boolean {
  return window.matchMedia("(pointer: coarse)").matches && window.matchMedia("(max-width: 1024px)").matches;
}

interface Props {
  dealId: string;
  leadName: string;
  touch: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Prévia editável do toque: balão de conversa, texto, destinatário e "Abrir WhatsApp". */
export function SendPreviewDialog({ dealId, leadName, touch, open, onOpenChange }: Props) {
  const router = useRouter();
  const [prepared, setPrepared] = useState<PrepareResult | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setPrepared(null);
    setError(null);
    prepareSendAction(dealId).then((result) => {
      if (!active) return;
      setPrepared(result);
      if (result.ok) setText(result.pendingText ?? result.text);
    });
    return () => {
      active = false;
    };
  }, [open, dealId]);

  // Tudo síncrono dentro do clique: o navegador só deixa abrir outra aba/app assim.
  function openWhatsApp() {
    if (!prepared?.ok) return;
    const problem = checkFinalText(text);
    if (problem) {
      setError(problem);
      return;
    }
    void fetch("/api/prospeccao/rascunho", {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dealId, text }),
    })
      .then((response) => response.json() as Promise<{ ok: boolean; error?: string }>)
      .then((result) => {
        if (result.ok) router.refresh();
        else toast.error(result.error ?? "O rascunho não foi salvo.");
      })
      .catch(() => undefined);
    const url = whatsappUrl(prepared.recipient, text);
    if (opensInSameTab()) window.location.href = url;
    else window.open(url, "_blank", "noopener,noreferrer");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`flex max-w-xl flex-col ${SHEET_ON_MOBILE}`}>
        <DialogHeader>
          <DialogTitle>{touch ? `${touch} · ${leadName}` : leadName}</DialogTitle>
          <DialogDescription>Confira e ajuste o texto. Ele abre pronto no WhatsApp; você aperta enviar lá.</DialogDescription>
        </DialogHeader>

        {!prepared ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : !prepared.ok ? (
          <Alert variant="error" title="Não dá para enviar ainda">
            {prepared.error}
          </Alert>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <Phone className="size-4 text-muted-foreground" aria-hidden />
              <span className="text-muted-foreground">Para</span>
              <span className="font-mono font-semibold text-foreground">{prepared.recipientDisplay}</span>
            </p>
            {prepared.assumedDdd ? (
              <p className="flex items-center gap-2 rounded-md border border-[#F5A524] px-3 py-2 text-[13px] font-semibold text-[#FCD34D]">
                <AlertTriangle className="size-4 shrink-0" aria-hidden />
                DDD assumido: {DEFAULT_DDD} — confira
              </p>
            ) : null}
            <WhatsAppBubble text={text} />
            <label htmlFor={`preview-${dealId}`} className="text-sm font-semibold text-foreground">
              Texto da mensagem
            </label>
            <Textarea
              id={`preview-${dealId}`}
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setError(null);
              }}
              rows={8}
              className="min-h-40 flex-1 text-[15px] leading-relaxed"
            />
            {error ? <Alert variant="error">{error}</Alert> : null}
            <div className="mt-auto flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" size="lg" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="button" size="lg" onClick={openWhatsApp} className="bg-[#25D366] text-[#0A0A0A] hover:bg-[#1FBF5B]">
                <WhatsAppIcon className="size-5" />
                Abrir WhatsApp
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
