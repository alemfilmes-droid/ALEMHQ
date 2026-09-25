"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/types";

interface InlineEditableProps {
  value: string;
  onSave: (value: string) => Promise<ActionResult>;
  placeholder?: string;
  multiline?: boolean;
  disabled?: boolean;
  className?: string;
  emptyLabel?: string;
  "aria-label"?: string;
}

/**
 * Clique para editar; salva ao perder o foco ou Enter (Ctrl/Cmd+Enter em texto longo);
 * Esc cancela. Atualização otimista: some do modo edição assim que o servidor confirma.
 */
export function InlineEditable({
  value,
  onSave,
  placeholder = "Clique para preencher",
  multiline = false,
  disabled = false,
  className,
  emptyLabel,
  "aria-label": ariaLabel,
}: InlineEditableProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed === value.trim()) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      const result = await onSave(trimmed);
      if (result.ok) {
        setEditing(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  function cancel() {
    setDraft(value);
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setEditing(true)}
        aria-label={ariaLabel}
        className={cn(
          "group flex w-full items-start gap-1.5 rounded-sm px-1.5 py-1 text-left transition-colors",
          !disabled && "hover:bg-surface-hover",
          disabled && "cursor-default",
          className,
        )}
      >
        <span className={cn("min-w-0 flex-1 whitespace-pre-wrap break-words", !value && "text-subtle")}>
          {value || emptyLabel || placeholder}
        </span>
        {!disabled ? <Pencil className="mt-0.5 size-3 shrink-0 text-subtle opacity-0 transition-opacity group-hover:opacity-100" aria-hidden /> : null}
      </button>
    );
  }

  const commonProps = {
    value: draft,
    disabled: pending,
    placeholder,
    "aria-label": ariaLabel,
    onChange: (event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => setDraft(event.target.value),
    onBlur: commit,
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancel();
      } else if (event.key === "Enter" && (!multiline || event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        commit();
      }
    },
  };

  return multiline ? (
    <Textarea ref={ref as React.Ref<HTMLTextAreaElement>} rows={4} {...commonProps} />
  ) : (
    <input
      ref={ref as React.Ref<HTMLInputElement>}
      className="flex h-9 w-full rounded-md border border-input bg-surface-raised px-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
      {...commonProps}
    />
  );
}
