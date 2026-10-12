"use client";

import { useState } from "react";
import { ActionError } from "@/components/ui/action-error";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Textarea } from "@/components/ui/textarea";
import { useSettledSubmit } from "@/features/finance/components/use-settled-submit";
import { reverseSettlementAction } from "@/features/finance/settled-actions";
import type { FinanceEntryType } from "@/lib/finance/settled-edit";

interface ReverseSettlementDialogProps {
  type: FinanceEntryType;
  id: string;
  version: number;
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EFFECT: Record<FinanceEntryType, string> = {
  payable:
    "O pagamento volta a ficar em aberto (pendente ou atrasado) em todos os totais. A data, o comprovante, o atraso e a multa/juros da baixa são limpos e ficam guardados no histórico. Depois, é só dar baixa de novo.",
  receivable:
    "O recebimento volta a ficar em aberto (pendente ou atrasado) em todos os totais. A data e o valor recebido são limpos e ficam guardados no histórico. Depois, é só dar baixa de novo.",
};

/** Estornar baixa: confirmação explicando o efeito; motivo obrigatório (o banco confere de novo). */
export function ReverseSettlementDialog({ type, id, version, label, open, onOpenChange }: ReverseSettlementDialogProps) {
  const { submit, pending, failure } = useSettledSubmit(onOpenChange);
  const [reason, setReason] = useState("");
  const [missing, setMissing] = useState(false);

  function confirm() {
    if (reason.trim().length < 3) {
      setMissing(true);
      return;
    }
    submit(() => reverseSettlementAction(type, id, version, { reason }));
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <DialogContent className="p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Estornar baixa?</DialogTitle>
          <DialogDescription>{label}</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{EFFECT[type]}</p>
        <ActionError message={failure?.message ?? null} reload={failure?.reload} />
        <FormField id="reverse-reason" label="Motivo do estorno" error={missing ? "Informe o motivo do estorno." : undefined}>
          <Textarea
            id="reverse-reason"
            rows={2}
            value={reason}
            aria-invalid={missing}
            onChange={(event) => {
              setReason(event.target.value);
              setMissing(false);
            }}
          />
        </FormField>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" size="lg" disabled={pending}>
              Voltar
            </Button>
          </DialogClose>
          <Button type="button" size="lg" loading={pending} onClick={confirm}>
            {pending ? "Estornando…" : "Estornar baixa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
