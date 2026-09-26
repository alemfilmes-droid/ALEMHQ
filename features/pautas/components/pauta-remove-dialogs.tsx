"use client";

import { useTransition } from "react";
import { Archive, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { archivePautaAction, deletePautaAction } from "@/features/pautas/actions";

export type PautaRemoval = { mode: "delete" | "archive"; id: string; title: string };

interface PautaRemoveDialogProps {
  removal: PautaRemoval;
  onOpenChange: (open: boolean) => void;
  /** Chamado depois de apagar/arquivar com sucesso: tira a pauta da tela. */
  onDone: (id: string) => void;
}

/**
 * Confirmação de "Apagar" (só quem criou; irreversível, leva responsáveis, comentários e histórico)
 * ou "Arquivar" (some dos quadros, fica no banco). A policy do banco decide de novo quem pode.
 */
export function PautaRemoveDialog({ removal, onOpenChange, onDone }: PautaRemoveDialogProps) {
  const [pending, startTransition] = useTransition();
  const isDelete = removal.mode === "delete";

  function confirm() {
    startTransition(async () => {
      const result = isDelete ? await deletePautaAction(removal.id) : await archivePautaAction(removal.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      onOpenChange(false);
      onDone(removal.id);
    });
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isDelete ? "Apagar pauta?" : "Arquivar pauta?"}</DialogTitle>
          <DialogDescription>
            <span className="font-semibold text-foreground">“{removal.title}”</span>{" "}
            {isDelete
              ? "será apagada com os responsáveis, comentários e histórico. Esta ação não pode ser desfeita."
              : "sai de todos os quadros, mas continua registrada no sistema."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancelar
            </Button>
          </DialogClose>
          <Button type="button" variant={isDelete ? "primary" : "secondary"} loading={pending} onClick={confirm}>
            {isDelete ? <Trash2 aria-hidden /> : <Archive aria-hidden />}
            {isDelete ? "Apagar pauta" : "Arquivar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
