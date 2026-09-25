"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/types";

interface InlineDateProps {
  value: string | null;
  onSave: (value: string | null) => Promise<ActionResult>;
  disabled?: boolean;
  "aria-label"?: string;
}

/** Data sempre visível; salva ao perder o foco quando o valor muda. */
export function InlineDate({ value, onSave, disabled, "aria-label": ariaLabel }: InlineDateProps) {
  const [draft, setDraft] = useState(value ?? "");
  const [pending, startTransition] = useTransition();

  function commit() {
    const next = draft === "" ? null : draft;
    if (next === value) return;
    startTransition(async () => {
      const result = await onSave(next);
      if (!result.ok) {
        toast.error(result.error);
        setDraft(value ?? "");
      }
    });
  }

  return (
    <Input
      type="date"
      value={draft}
      disabled={disabled || pending}
      aria-label={ariaLabel}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      className="h-9"
    />
  );
}
