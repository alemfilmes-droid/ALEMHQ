"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteTimeEntryAction } from "@/features/time-tracking/actions";

interface DeleteEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entryId: string;
}

export function DeleteEntryDialog({ open, onOpenChange, entryId }: DeleteEntryDialogProps) {
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await deleteTimeEntryAction(entryId);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remover lançamento.</DialogTitle>
          <DialogDescription>
            O registro some do extrato e dos totais, mas fica guardado no histórico de atividades — não é uma exclusão definitiva.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Voltar</Button>
          </DialogClose>
          <Button loading={pending} onClick={confirm}>
            Remover
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
