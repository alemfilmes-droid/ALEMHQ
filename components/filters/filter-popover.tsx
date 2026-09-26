"use client";

import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ListFilter, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StatusDot } from "@/components/ui/status-dot";
import type { StatusTone } from "@/lib/status";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
  /** Ponto de cor ao lado do rótulo (status, squad, prioridade). */
  tone?: StatusTone;
}

export interface FilterSection {
  /** Chave na URL — a lista vai como `?chave=a,b`. */
  key: string;
  label: string;
  options: FilterOption[];
}

interface FilterPopoverProps {
  sections: FilterSection[];
  /** Seções que não são lista de checkboxes (período, faixa de valor…), renderizadas antes das listas. */
  extra?: ReactNode;
  /** Quantos filtros o `extra` tem ativos (entra no contador do botão). */
  extraActiveCount?: number;
  /** Outras chaves da URL que "Limpar filtros" também remove (as do `extra`). */
  extraKeys?: readonly string[];
  /** Chamado ao limpar (para zerar estado local do `extra`). */
  onClear?: () => void;
  /** Esconde os chips de filtros ativos ao lado do botão. */
  hideChips?: boolean;
  className?: string;
}

type Selection = Record<string, string[]>;

function readSelection(searchParams: URLSearchParams, sections: FilterSection[]): Selection {
  const selection: Selection = {};
  for (const section of sections) {
    const raw = searchParams.get(section.key);
    selection[section.key] = raw ? raw.split(",").filter(Boolean) : [];
  }
  return selection;
}

/** Telas estreitas (< 640px): as mudanças ficam num rascunho e só valem no "Aplicar". */
function useIsNarrow() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const update = () => setNarrow(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return narrow;
}

/**
 * Popover único de filtros do sistema (pautas, CRM, financeiro…), sempre dirigido pela URL.
 *
 * Nunca estoura a janela: largura = min(22rem, viewport − 2rem); altura limitada ao espaço que o
 * Radix calcula como disponível (--radix-popover-content-available-height) com rolagem interna, e
 * `collisionPadding` para ficar a 12px das bordas. Cabeçalho e rodapé fixos; o meio rola. Cada
 * seção tem título, busca (quando a lista é longa) e checkboxes. No celular as escolhas só valem
 * ao tocar em "Aplicar"; no desktop, na hora.
 */
export function FilterPopover({ sections, extra, extraActiveCount = 0, extraKeys = [], onClear, hideChips = false, className }: FilterPopoverProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const narrow = useIsNarrow();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const paramsKey = searchParams.toString();
  const applied = useMemo(() => readSelection(new URLSearchParams(paramsKey), sections), [paramsKey, sections]);
  const [draft, setDraft] = useState<Selection>(applied);
  const [queries, setQueries] = useState<Record<string, string>>({});

  // Reabrir parte sempre do que está na URL, nunca de um rascunho antigo.
  function handleOpenChange(next: boolean) {
    if (next) setDraft(applied);
    setOpen(next);
  }

  function commit(next: Selection) {
    const params = new URLSearchParams(searchParams.toString());
    for (const section of sections) {
      const values = next[section.key] ?? [];
      if (values.length === 0) params.delete(section.key);
      else params.set(section.key, values.join(","));
    }
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  function toggle(key: string, value: string) {
    const current = draft[key] ?? [];
    const next = { ...draft, [key]: current.includes(value) ? current.filter((item) => item !== value) : [...current, value] };
    setDraft(next);
    if (!narrow) commit(next);
  }

  function clearAll() {
    const empty: Selection = Object.fromEntries(sections.map((section) => [section.key, []]));
    setDraft(empty);
    const params = new URLSearchParams(searchParams.toString());
    for (const section of sections) params.delete(section.key);
    for (const key of extraKeys) params.delete(key);
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
    onClear?.();
  }

  const listCount = Object.values(applied).reduce((total, values) => total + values.length, 0);
  const activeCount = listCount + extraActiveCount;
  const draftDirty = sections.some((section) => (draft[section.key] ?? []).join(",") !== (applied[section.key] ?? []).join(","));

  const chips = sections.flatMap((section) =>
    (applied[section.key] ?? []).map((value) => {
      const option = section.options.find((item) => item.value === value);
      return {
        id: `${section.key}:${value}`,
        label: `${section.label}: ${option?.label ?? value}`,
        remove: () => {
          const next = { ...applied, [section.key]: (applied[section.key] ?? []).filter((item) => item !== value) };
          setDraft(next);
          commit(next);
        },
      };
    }),
  );

  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-2", className)}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="secondary" className="shrink-0" aria-busy={pending || undefined}>
            <ListFilter aria-hidden />
            Filtros
            {activeCount > 0 ? (
              <Badge variant="solid" className="ml-0.5 px-1.5 py-0 tabular-nums">
                {activeCount}
              </Badge>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          collisionPadding={12}
          className="flex w-[min(22rem,calc(100vw-1.5rem))] flex-col overflow-hidden p-0"
          style={{ maxHeight: "min(36rem, var(--radix-popover-content-available-height, 70vh))" }}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
            <p className="text-sm font-bold">
              Filtros
              {activeCount > 0 ? <span className="ml-1.5 font-semibold text-subtle">({activeCount})</span> : null}
            </p>
            {activeCount > 0 || draftDirty ? (
              <button type="button" onClick={clearAll} className="text-xs font-semibold underline underline-offset-4 hover:text-muted-foreground">
                Limpar filtros
              </button>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-4">
            {extra}
            {sections.map((section) => {
              const selected = draft[section.key] ?? [];
              const query = (queries[section.key] ?? "").trim().toLowerCase();
              const searchable = section.options.length > 8;
              const options = query ? section.options.filter((option) => option.label.toLowerCase().includes(query)) : section.options;
              return (
                <fieldset key={section.key} className="space-y-2">
                  <legend className="mb-2 flex w-full items-center justify-between gap-2">
                    <span className="eyebrow">{section.label}</span>
                    {selected.length > 0 ? <span className="text-[11px] font-semibold tabular-nums text-muted-foreground">{selected.length}</span> : null}
                  </legend>
                  {searchable ? (
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-subtle" aria-hidden />
                      <Input
                        aria-label={`Buscar em ${section.label}`}
                        placeholder="Buscar"
                        value={queries[section.key] ?? ""}
                        onChange={(event) => setQueries((current) => ({ ...current, [section.key]: event.target.value }))}
                        className="h-8 pl-8 text-[13px]"
                      />
                    </div>
                  ) : null}
                  {options.length === 0 ? (
                    <p className="text-xs text-subtle">Nada para mostrar.</p>
                  ) : (
                    <div className="max-h-48 space-y-0.5 overflow-y-auto pr-1">
                      {options.map((option) => {
                        const id = `f-${section.key}-${option.value}`;
                        return (
                          <label
                            key={option.value}
                            htmlFor={id}
                            className="flex cursor-pointer items-center gap-2.5 rounded-sm px-1.5 py-1.5 text-sm transition-colors hover:bg-surface-hover"
                          >
                            <Checkbox id={id} checked={selected.includes(option.value)} onCheckedChange={() => toggle(section.key, option.value)} />
                            {option.tone ? <StatusDot tone={option.tone} /> : null}
                            <span className="min-w-0 truncate">{option.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </fieldset>
              );
            })}
          </div>

          {narrow ? (
            <div className="flex shrink-0 gap-2 border-t border-border px-4 py-3">
              <Button type="button" variant="ghost" className="flex-1" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="button"
                className="flex-1"
                onClick={() => {
                  commit(draft);
                  setOpen(false);
                }}
              >
                Aplicar
              </Button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>

      {!hideChips && chips.length > 0 ? (
        <ul className="flex min-w-0 flex-wrap items-center gap-1.5" aria-label="Filtros ativos">
          {chips.map((chip) => (
            <li key={chip.id}>
              <Badge variant="muted" className="max-w-[16rem] pr-1">
                <span className="truncate">{chip.label}</span>
                <button type="button" onClick={chip.remove} aria-label={`Remover filtro ${chip.label}`} className="rounded-full p-0.5 hover:bg-surface">
                  <X className="size-3" aria-hidden />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Busca por texto dirigida pela URL (Enter aplica; vazio remove). Companheira do FilterPopover. */
export function UrlSearchInput({ paramKey = "busca", label, className }: { paramKey?: string; label: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get(paramKey) ?? "");

  useEffect(() => {
    setValue(searchParams.get(paramKey) ?? "");
  }, [searchParams, paramKey]);

  function apply(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.trim()) params.set(paramKey, next.trim());
    else params.delete(paramKey);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <form
      className={cn("relative w-full sm:w-56", className)}
      onSubmit={(event) => {
        event.preventDefault();
        apply(value);
      }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
      <Input
        type="search"
        aria-label={label}
        placeholder={label}
        className="pl-9"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
          if (event.target.value === "" && searchParams.get(paramKey)) apply("");
        }}
      />
    </form>
  );
}
