"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { discardLeadAction, pauseLeadAction } from "@/features/prospeccao/cadence-actions";
import { SHEET_ON_MOBILE } from "@/features/prospeccao/components/sheet";

const PRESETS = {
  pausar: ["Cliente pediu para esperar", "Recesso ou férias da escola", "Aguardando informação interna"],
  descartar: ["Sem perfil para a além", "Fechou com outra produtora", "Contato inválido", "Pediu para não ser contatado"],
} as const;

type Mode = keyof typeof PRESETS;

/** Pausar ou descartar o lead, sempre com motivo (opção pronta e/ou texto livre). */
export function ReasonDialog({ dealId, open, onOpenChange }: { dealId: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [mode, setMode] = useState<Mode>("pausar");
  const [preset, setPreset] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const reason = [preset, note.trim()].filter(Boolean).join(" — ");

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setPreset("");
      setNote("");
      setError(null);
    }
  }

  function confirm() {
    if (reason.length < 2) return setError("Escolha ou escreva o motivo.");
    startTransition(async () => {
      const result = mode === "pausar" ? await pauseLeadAction(dealId, reason) : await discardLeadAction(dealId, reason);
      if (!result.ok) return setError(result.error);
      toast.success(result.message);
      close(false);
    });
  }

  const choice = (active: boolean) =>
    `flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-md border px-3 text-sm font-semibold ${active ? "border-foreground text-foreground" : "border-border text-muted-foreground"}`;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className={`max-w-lg ${SHEET_ON_MOBILE}`}>
        <DialogHeader>
          <DialogTitle>Pausar ou descartar</DialogTitle>
          <DialogDescription>Pausado sai da fila e pode voltar depois. Descartado sai da prospecção (o negócio continua no funil).</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2" role="radiogroup" aria-label="Ação">
            {(["pausar", "descartar"] as const).map((item) => (
              <label key={item} className={choice(mode === item)}>
                <input
                  type="radio"
                  className="sr-only"
                  checked={mode === item}
                  onChange={() => {
                    setMode(item);
                    setPreset("");
                  }}
                />
                {item === "pausar" ? "Pausar" : "Descartar"}
              </label>
            ))}
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold text-foreground">Motivo</legend>
            <div className="flex flex-wrap gap-2">
              {PRESETS[mode].map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={preset === item}
                  onClick={() => setPreset(preset === item ? "" : item)}
                  className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${preset === item ? "border-foreground bg-foreground text-background" : "border-border-strong text-muted-foreground"}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </fieldset>
          <FormField id={`motivo-${dealId}`} label="Detalhe (opcional)">
            <Input id={`motivo-${dealId}`} className="h-11" maxLength={200} value={note} onChange={(event) => setNote(event.target.value)} />
          </FormField>
          {error ? <Alert variant="error">{error}</Alert> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" size="lg" onClick={() => close(false)}>
              Cancelar
            </Button>
            <Button type="button" size="lg" loading={pending} onClick={confirm}>
              {mode === "pausar" ? "Pausar lead" : "Descartar lead"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
