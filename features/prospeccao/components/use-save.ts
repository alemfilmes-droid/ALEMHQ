"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/types";

/** Roda uma server action com toast de sucesso/erro; `onSuccess` só depois de dar certo. */
export function useSave() {
  const [pending, startTransition] = useTransition();
  function run(action: () => Promise<ActionResult>, onSuccess?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast.success(result.message);
        onSuccess?.();
      } else {
        toast.error(result.error);
      }
    });
  }
  return { pending, run };
}
