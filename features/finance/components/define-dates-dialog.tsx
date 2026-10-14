"use client";

import { useState, useTransition } from "react";
import { CalendarCheck } from "lucide-react";
import { toast } from "sonner";
import { defineReceivableDatesAction } from "@/features/finance/actions";
import { draftsFromRows, InstallmentsEditor, suggestedRows, type InstallmentRow } from "@/features/finance/components/installments-editor";
import { MethodSelect } from "@/features/finance/components/method-select";
import { formatCents } from "@/features/finance/money";
import type { ReceivableItem } from "@/features/finance/types";
import { ActionError } from "@/components/ui/action-error";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { checkInstallments } from "@/lib/budgets/approval";
import type { PaymentMethod } from "@/types";

/** Recebimento "Data a definir": a pessoa do financeiro define a data (ou as parcelas que somam o valor). */
export function DefineDatesDialog({ receivable, today, open, onOpenChange }: { receivable: ReceivableItem; today: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [rows, setRows] = useState<InstallmentRow[]>(() => suggestedRows(receivable.amount, 1, today));
  const [method, setMethod] = useState<PaymentMethod | "">(receivable.paymentMethod ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const check = checkInstallments(receivable.amount, draftsFromRows(rows));

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await defineReceivableDatesAction(receivable.id, { method: method || null, installments: draftsFromRows(rows) });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      toast.success(result.message);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Definir data de pagamento.</DialogTitle>
          <DialogDescription>
            {receivable.companyName} · {receivable.description} · <span data-sensitive>{formatCents(receivable.amount)}</span>. Uma data, ou parcelas que somem o valor.
          </DialogDescription>
        </DialogHeader>
        <InstallmentsEditor idPrefix="define-dates" totalCents={receivable.amount} rows={rows} onChange={setRows} />
        <FormField id="define-dates-method" label="Forma de pagamento">
          <MethodSelect id="define-dates-method" value={method} onChange={setMethod} optional />
        </FormField>
        <ActionError message={error} />
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={save} loading={pending} disabled={!check.ok}>
            <CalendarCheck aria-hidden />
            Salvar data
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
