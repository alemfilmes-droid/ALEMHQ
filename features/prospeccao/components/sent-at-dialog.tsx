"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EffectiveTimeField, type EffectiveTimeValue } from "@/features/crm/components/flow/effective-time-field";
import { effectiveDefaults, parseEffectiveTime } from "@/lib/crm/effective-time";

interface SentAtDialogProps {
  leadName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = agora. */
  onConfirm: (value: EffectiveTimeValue | null) => void;
}

/** "Marcar enviado" com outro horário: o toque conta (cadência e meta) a partir do horário informado. */
export function SentAtDialog({ leadName, open, onOpenChange, onConfirm }: SentAtDialogProps) {
  const [value, setValue] = useState<EffectiveTimeValue | null>(() => {
    const now = effectiveDefaults();
    return { date: now.date, time: now.time };
  });
  const [error, setError] = useState<string | undefined>();

  function confirm() {
    if (!value) {
      onConfirm(null);
      onOpenChange(false);
      return;
    }
    const parsed = parseEffectiveTime(value.date, value.time);
    if (!parsed.ok) return setError(parsed.error);
    onConfirm(value);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Marcar enviado em outro horário.</DialogTitle>
          <DialogDescription>{leadName}: informe quando a mensagem foi enviada de verdade.</DialogDescription>
        </DialogHeader>
        <EffectiveTimeField
          idPrefix="sent-at"
          value={value}
          onChange={(next) => {
            setValue(next);
            setError(undefined);
          }}
          error={error}
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary" size="lg">
              Voltar
            </Button>
          </DialogClose>
          <Button type="button" size="lg" onClick={confirm}>
            <Check aria-hidden />
            Marcar enviado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
