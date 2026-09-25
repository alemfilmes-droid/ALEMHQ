"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleTimeEntryAction } from "@/features/time-tracking/actions";
import { toneColor } from "@/lib/status";

type PendingAction = "start" | "end" | "pause" | null;

interface TimerActionsProps {
  isOpen: boolean;
  hasEntriesToday: boolean;
}

/**
 * "Encerrar expediente" e "Pausar" fazem exatamente a mesma coisa no banco (uma 'saída') — o
 * modelo não distingue pausa de fim de dia, então os dois botões só existem para deixar a
 * intenção clara; retomar depois é sempre a mesma 'entrada'.
 */
export function TimerActions({ isOpen, hasEntriesToday }: TimerActionsProps) {
  const [pending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  function fire(action: Exclude<PendingAction, null>, kind: "entrada" | "saida", note?: string) {
    setPendingAction(action);
    startTransition(async () => {
      const result = await toggleTimeEntryAction(kind, note);
      if (result.ok) toast.success(result.message);
      else toast.error(result.error);
      setPendingAction(null);
    });
  }

  if (isOpen) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button size="lg" loading={pending && pendingAction === "end"} disabled={pending} onClick={() => fire("end", "saida")}>
          Encerrar expediente
        </Button>
        <Button
          variant="secondary"
          loading={pending && pendingAction === "pause"}
          disabled={pending}
          onClick={() => fire("pause", "saida", "Pausa")}
          style={{ borderColor: toneColor("danger"), color: toneColor("danger") }}
        >
          Pausar
        </Button>
      </div>
    );
  }

  return (
    <Button size="lg" loading={pending && pendingAction === "start"} disabled={pending} onClick={() => fire("start", "entrada")}>
      {hasEntriesToday ? "Retomar" : "Começar a trabalhar"}
    </Button>
  );
}
