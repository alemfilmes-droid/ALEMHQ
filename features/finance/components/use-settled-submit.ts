"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { needsReload, runAction, type ClientActionResult } from "@/lib/actions/client-action";
import { isConflictMessage } from "@/lib/finance/settled-edit";

/**
 * Envio das janelas de lançamento baixado (editar, estornar): erro sempre visível, "Recarregar o HQ"
 * quando outra pessoa alterou antes (ou a tela ficou antiga) e a lista atualizada na hora.
 */
export function useSettledSubmit(onOpenChange: (open: boolean) => void) {
  const router = useRouter();
  const [failure, setFailure] = useState<{ message: string; reload: boolean } | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(call: () => Promise<ClientActionResult>) {
    setFailure(null);
    startTransition(async () => {
      const result = await runAction(call);
      if (result.ok) {
        toast.success(result.message);
        onOpenChange(false);
        router.refresh();
      } else {
        setFailure({ message: result.error, reload: needsReload(result) || isConflictMessage(result.error) });
      }
    });
  }
  return { submit, pending, failure, clearFailure: () => setFailure(null) };
}
