"use client";

import type { FormEventHandler, ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface FlowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  error?: ReactNode;
  pending?: boolean;
  submitLabel: string;
  onSubmit: FormEventHandler<HTMLFormElement>;
  children: ReactNode;
  /** Ação extra ao lado do botão principal (ex.: "Qualificar agora"). */
  footerExtra?: ReactNode;
  wide?: boolean;
}

/** Casca única dos diálogos do fluxo comercial: título, aviso da regra, campos, erro e rodapé. */
export function FlowDialog({ open, onOpenChange, title, description, error, pending, submitLabel, onSubmit, children, footerExtra, wide }: FlowDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={wide ? "max-w-xl" : undefined}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-5">
          {error ? <Alert variant="error">{error}</Alert> : null}
          {children}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Cancelar
              </Button>
            </DialogClose>
            {footerExtra}
            <Button type="submit" loading={pending}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
