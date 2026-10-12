"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { needsReload, runAction } from "@/lib/actions/client-action";
import type { ActionResult } from "@/types";

/** Envio das janelas do ciclo de vida: erro visível, "Recarregar o HQ" quando preciso, tela atualizada. */
export function useLifecycleSubmit(onDone: () => void) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<{ message: string; reload: boolean } | null>(null);
  function submit(call: () => Promise<ActionResult>) {
    setFailure(null);
    startTransition(async () => {
      const result = await runAction(call);
      if (!result.ok) return setFailure({ message: result.error, reload: needsReload(result) });
      toast.success(result.message);
      onDone();
      router.refresh();
    });
  }
  return { pending, failure, submit };
}
