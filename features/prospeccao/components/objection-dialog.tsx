"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { registerObjectionAction, setDecisionMakerAction, setManualReactivationAction } from "@/features/prospeccao/cadence-actions";
import { SHEET_ON_MOBILE } from "@/features/prospeccao/components/sheet";
import type { ObjectionOption } from "@/features/prospeccao/types";
import { addDays } from "@/lib/calendar";
import { objectionFollowUp, reactivationDateError } from "@/lib/prospeccao/objection";

type Step = { kind: "escolher" } | { kind: "resposta"; objection: ObjectionOption } | { kind: "reiniciar"; objection: ObjectionOption };

interface Props {
  dealId: string;
  objections: ObjectionOption[];
  today: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Objeção (spec 5): registra, mostra a resposta para copiar e segue a ação do HQ. */
export function ObjectionDialog({ dealId, objections, today, open, onOpenChange }: Props) {
  const [step, setStep] = useState<Step>({ kind: "escolher" });
  const [date, setDate] = useState(addDays(today, 7));
  const [decisor, setDecisor] = useState({ name: "", role: "", whatsapp: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function close(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setStep({ kind: "escolher" });
      setError(null);
      setDecisor({ name: "", role: "", whatsapp: "" });
    }
  }

  function choose(objection: ObjectionOption) {
    startTransition(async () => {
      const result = await registerObjectionAction(dealId, objection.id);
      if (!result.ok) return void toast.error(result.error);
      toast.success(result.message);
      setStep({ kind: "resposta", objection });
    });
  }

  function scheduleReactivation() {
    const problem = reactivationDateError(date, today);
    if (problem) return setError(problem);
    startTransition(async () => {
      const result = await setManualReactivationAction(dealId, date);
      if (!result.ok) return setError(result.error);
      toast.success(result.message);
      close(false);
    });
  }

  function saveDecisor(restart: boolean) {
    startTransition(async () => {
      const result = await setDecisionMakerAction(dealId, decisor, restart);
      if (!result.ok) {
        setStep((current) => (current.kind === "reiniciar" ? { kind: "resposta", objection: current.objection } : current));
        return setError(result.error);
      }
      toast.success(result.message);
      close(false);
    });
  }

  const followUp = step.kind === "escolher" ? null : objectionFollowUp(step.objection.hqAction);

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className={`max-w-xl ${SHEET_ON_MOBILE}`}>
        <DialogHeader>
          <DialogTitle>Objeção</DialogTitle>
          <DialogDescription>
            {step.kind === "escolher" ? "O que o cliente disse? Fica registrado no lead, com a data e o playbook." : step.objection.label}
          </DialogDescription>
        </DialogHeader>

        {step.kind === "escolher" ? (
          <ul className="grid gap-2">
            {objections.map((objection) => (
              <li key={objection.id}>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => choose(objection)}
                  className="flex min-h-11 w-full items-center gap-3 rounded-md border border-border-strong px-3 py-2 text-left text-sm transition-colors hover:bg-surface-hover disabled:opacity-50"
                >
                  <span className="w-36 shrink-0 font-mono text-[13px] text-muted-foreground">{objection.shortcut}</span>
                  <span className="font-semibold text-foreground">{objection.label}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2 rounded-md border border-border bg-surface-raised p-3">
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">{step.objection.responseBody}</p>
              <CopyButton value={step.objection.responseBody} label="Copiar resposta" size="lg" copiedMessage="Resposta copiada." />
            </div>

            {error ? <Alert variant="error">{error}</Alert> : null}

            {followUp === "pedir_data" ? (
              <div className="space-y-3">
                <FormField id={`reativar-${dealId}`} label="Quando chamar de novo?" hint="O lead sai da fila até essa data.">
                  <Input
                    id={`reativar-${dealId}`}
                    type="date"
                    className="h-11"
                    min={addDays(today, 1)}
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    aria-describedby={`reativar-${dealId}-message`}
                  />
                </FormField>
                <Button type="button" size="lg" loading={pending} onClick={scheduleReactivation}>
                  Agendar reativação
                </Button>
              </div>
            ) : null}

            {followUp === "novo_decisor" && step.kind === "resposta" ? (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-foreground">Novo decisor</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  {(
                    [
                      ["name", "Nome", 120],
                      ["role", "Cargo", 80],
                      ["whatsapp", "WhatsApp", 20],
                    ] as const
                  ).map(([key, label, max]) => (
                    <FormField key={key} id={`decisor-${key}-${dealId}`} label={label}>
                      <Input
                        id={`decisor-${key}-${dealId}`}
                        className="h-11"
                        maxLength={max}
                        type={key === "whatsapp" ? "tel" : "text"}
                        value={decisor[key]}
                        onChange={(event) => setDecisor((current) => ({ ...current, [key]: event.target.value }))}
                      />
                    </FormField>
                  ))}
                </div>
                <Button
                  type="button"
                  size="lg"
                  disabled={decisor.name.trim().length < 2}
                  onClick={() => {
                    setError(null);
                    setStep({ kind: "reiniciar", objection: step.objection });
                  }}
                >
                  Salvar decisor
                </Button>
              </div>
            ) : null}

            {step.kind === "reiniciar" ? (
              <div className="space-y-3 rounded-md border border-border-strong p-3">
                <p className="text-sm font-semibold text-foreground">Reiniciar a cadência no Toque 1?</p>
                <p className="text-[13px] text-muted-foreground">Sim: o Toque 1 vai para o novo decisor hoje. Não: a cadência segue de onde está.</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="button" size="lg" loading={pending} onClick={() => saveDecisor(true)}>
                    Sim, reiniciar
                  </Button>
                  <Button type="button" variant="secondary" size="lg" disabled={pending} onClick={() => saveDecisor(false)}>
                    Não, só salvar
                  </Button>
                </div>
              </div>
            ) : null}

            {followUp === "nada" ? (
              <Button type="button" size="lg" variant="secondary" onClick={() => close(false)}>
                Concluir
              </Button>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
