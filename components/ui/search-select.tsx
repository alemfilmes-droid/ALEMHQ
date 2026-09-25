"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface SearchSelectOption {
  value: string;
  label: string;
  /** Texto secundário (ex.: cliente do projeto) — também entra na busca. */
  hint?: string | null;
  leading?: ReactNode;
}

interface SearchSelectProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchSelectOption[];
  placeholder: string;
  emptyLabel?: string;
  disabled?: boolean;
}

const MAX_VISIBLE = 60;

/** Seleção única com busca (lista longa: clientes, projetos, negócios, pautas). "" = nada selecionado. */
export function SearchSelect({ id, value, onChange, options, placeholder, emptyLabel = "Nada encontrado.", disabled = false }: SearchSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value) ?? null;
  const term = query.trim().toLocaleLowerCase("pt-BR");
  const filtered = (term
    ? options.filter((option) => `${option.label} ${option.hint ?? ""}`.toLocaleLowerCase("pt-BR").includes(term))
    : options
  ).slice(0, MAX_VISIBLE);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <div className="relative">
        <PopoverTrigger asChild disabled={disabled}>
          <button
            id={id}
            type="button"
            role="combobox"
            aria-expanded={open}
            aria-controls={`${id}-listbox`}
            className="flex h-10 w-full items-center gap-2 rounded-md border border-input bg-surface-raised px-3 pr-16 text-left text-sm transition-colors hover:border-subtle disabled:cursor-not-allowed disabled:opacity-50"
          >
            {selected?.leading}
            <span className={cn("min-w-0 flex-1 truncate", !selected && "text-subtle")}>{selected ? selected.label : placeholder}</span>
          </button>
        </PopoverTrigger>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-subtle">
          <ChevronsUpDown className="size-4" aria-hidden />
        </span>
        {selected && !disabled ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-9 top-1/2 -translate-y-1/2 rounded-sm p-0.5 text-subtle hover:text-foreground"
            aria-label="Limpar seleção"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-64 p-2">
        <Input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar" aria-label="Buscar" className="mb-2 h-9" />
        <ul id={`${id}-listbox`} role="listbox" aria-labelledby={id} className="max-h-64 overflow-y-auto">
          {filtered.length === 0 ? <li className="px-2 py-3 text-center text-[13px] text-subtle">{emptyLabel}</li> : null}
          {filtered.map((option) => (
            <li key={option.value}>
              <button
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  setQuery("");
                }}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-[13px] hover:bg-surface-hover"
              >
                {option.leading}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{option.label}</span>
                  {option.hint ? <span className="block truncate text-[12px] text-subtle">{option.hint}</span> : null}
                </span>
                {option.value === value ? <Check className="size-4 shrink-0" aria-hidden /> : null}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
