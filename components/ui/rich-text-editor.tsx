"use client";

import { useId, useRef, useState } from "react";
import { Bold, Eye, Italic, Link2, List, ListOrdered, Pencil, Quote } from "lucide-react";
import { RichText } from "@/components/ui/rich-text";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
}

type Action = { label: string; icon: typeof Bold; wrap?: [string, string]; prefix?: string };

const ACTIONS: Action[] = [
  { label: "Negrito", icon: Bold, wrap: ["**", "**"] },
  { label: "Itálico", icon: Italic, wrap: ["*", "*"] },
  { label: "Lista", icon: List, prefix: "- " },
  { label: "Lista numerada", icon: ListOrdered, prefix: "1. " },
  { label: "Citação", icon: Quote, prefix: "> " },
  { label: "Link", icon: Link2, wrap: ["[", "](https://)"] },
];

/** Editor do texto rico (subconjunto de Markdown, ver <RichText>) com barra de formatação e prévia. */
export function RichTextEditor({ id, value, onChange, placeholder, invalid, describedBy }: RichTextEditorProps) {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const ref = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(false);

  function apply(action: Action) {
    const element = ref.current;
    if (!element) return;
    const { selectionStart: start, selectionEnd: end } = element;
    const selected = value.slice(start, end);
    let next: string;
    let cursor: number;
    if (action.wrap) {
      const [before, after] = action.wrap;
      next = value.slice(0, start) + before + (selected || "texto") + after + value.slice(end);
      cursor = start + before.length + (selected || "texto").length;
    } else {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      next = value.slice(0, lineStart) + (action.prefix ?? "") + value.slice(lineStart);
      cursor = end + (action.prefix ?? "").length;
    }
    onChange(next);
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div className={cn("overflow-hidden rounded-md border border-input bg-surface-raised", invalid && "border-2 border-foreground")}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-1.5 py-1" role="toolbar" aria-label="Formatação">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              type="button"
              onClick={() => apply(action)}
              disabled={preview}
              aria-label={action.label}
              title={action.label}
              className="rounded-sm p-1.5 text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground disabled:opacity-40"
            >
              <Icon className="size-4" aria-hidden />
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setPreview((current) => !current)}
          aria-pressed={preview}
          className="ml-auto flex items-center gap-1.5 rounded-sm px-2 py-1 text-[12px] font-semibold text-muted-foreground hover:bg-surface-hover hover:text-foreground"
        >
          {preview ? <Pencil className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
          {preview ? "Editar" : "Prévia"}
        </button>
      </div>
      {preview ? (
        <div className="min-h-40 px-3 py-2">{value.trim() ? <RichText source={value} /> : <p className="text-sm text-subtle">Nada para mostrar.</p>}</div>
      ) : (
        <Textarea
          ref={ref}
          id={textareaId}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className="min-h-40 rounded-none border-0 bg-transparent focus-visible:outline-none"
        />
      )}
    </div>
  );
}
