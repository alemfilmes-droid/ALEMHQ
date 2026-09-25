"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ActionResult } from "@/types";

interface CancelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => Promise<ActionResult>;
}

export function CancelDialog({ open, onOpenChange, title, description, onConfirm }: CancelDialogProps) {
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await onConfirm();
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Voltar</Button>
          </DialogClose>
          <Button loading={pending} onClick={confirm}>
            Confirmar cancelamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
