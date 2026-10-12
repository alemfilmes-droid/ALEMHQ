"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { UndoableResult } from "@/features/prospeccao/cadence-actions";
import { undoAction } from "@/features/prospeccao/cadence-actions";

/** Roda uma ação desfazível e mostra o aviso com "Desfazer" por 10 segundos. */
export function useUndoable() {
  const [pending, startTransition] = useTransition();
  function run(action: () => Promise<UndoableResult>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) return void toast.error(result.error);
      toast.success(result.message, {
        duration: 10_000,
        action: {
          label: "Desfazer",
          onClick: () => {
            void undoAction(result.undoId).then((undone) => (undone.ok ? toast.success(undone.message) : toast.error(undone.error)));
          },
        },
      });
    });
  }
  return { pending, run };
}
