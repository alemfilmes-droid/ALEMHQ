"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PRIORITIES, PRIORITY_LABELS } from "@/lib/domain";
import type { PautaFormOptions } from "@/features/pautas/types";

const FILTER_KEYS = ["lider", "responsavel", "cliente", "prioridade", "projeto"] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

interface PautasFiltersProps {
  options: PautaFormOptions;
  companies: { id: string; name: string }[];
}

function parseList(value: string | null): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

export function PautasFilters({ options, companies }: PautasFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("busca") ?? "");

  function getList(key: FilterKey) {
    return parseList(searchParams.get(key));
  }

  function setList(key: FilterKey, values: string[]) {
    const params = new URLSearchParams(searchParams.toString());
    if (values.length === 0) params.delete(key);
    else params.set(key, values.join(","));
    router.replace(`${pathname}?${params.toString()}`);
  }

  function toggleValue(key: FilterKey, value: string) {
    const current = getList(key);
    setList(key, current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
  }

  function updateSearch(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) params.set("busca", value.trim());
    else params.delete("busca");
    router.replace(`${pathname}?${params.toString()}`);
  }

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of FILTER_KEYS) params.delete(key);
    router.replace(`${pathname}?${params.toString()}`);
  }

  const activeCount = FILTER_KEYS.reduce((total, key) => total + getList(key).length, 0);

  const sections: { key: FilterKey; label: string; items: { id: string; label: string }[] }[] = [
    { key: "prioridade", label: "Prioridade", items: PRIORITIES.map((item) => ({ id: item, label: PRIORITY_LABELS[item] })) },
    { key: "lider", label: "Líder", items: options.members.map((m) => ({ id: m.id, label: m.full_name })) },
    { key: "responsavel", label: "Responsável", items: options.members.map((m) => ({ id: m.id, label: m.full_name })) },
    { key: "cliente", label: "Cliente", items: companies.map((c) => ({ id: c.id, label: c.name })) },
    { key: "projeto", label: "Projeto", items: options.projects.map((p) => ({ id: p.id, label: p.name })) },
  ];

  const chips = sections.flatMap((section) =>
    getList(section.key).map((id) => ({
      key: `${section.key}:${id}`,
      label: section.items.find((item) => item.id === id)?.label ?? id,
      onRemove: () => toggleValue(section.key, id),
    })),
  );

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="secondary" className="shrink-0">
            <Filter aria-hidden />
            Filtros
            {activeCount > 0 ? (
              <Badge variant="solid" className="ml-0.5 px-1.5 py-0">
                {activeCount}
              </Badge>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 max-h-[70vh] overflow-y-auto">
          <div className="flex items-center justify-between gap-2 pb-3">
            <p className="text-sm font-bold">Filtros</p>
            {activeCount > 0 ? (
              <Button variant="ghost" size="sm" onClick={clearAll} className="h-auto p-0 text-xs font-semibold underline underline-offset-4">
                Limpar filtros
              </Button>
            ) : null}
          </div>
          <div className="space-y-5">
            {sections.map((section) => {
              const selected = getList(section.key);
              return (
                <fieldset key={section.key} className="space-y-2">
                  <legend className="eyebrow">{section.label}</legend>
                  {section.items.length === 0 ? (
                    <p className="text-xs text-subtle">Nada para mostrar.</p>
                  ) : (
                    <div className="max-h-36 space-y-1.5 overflow-y-auto pr-1">
                      {section.items.map((item) => {
                        const id = `filtro-${section.key}-${item.id}`;
                        return (
                          <div key={item.id} className="flex items-center gap-2">
                            <Checkbox
                              id={id}
                              checked={selected.includes(item.id)}
                              onCheckedChange={() => toggleValue(section.key, item.id)}
                            />
                            <Label htmlFor={id} className="cursor-pointer truncate font-normal">
                              {item.label}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </fieldset>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <Badge key={chip.key} variant="muted" className="pr-1">
              {chip.label}
              <button type="button" onClick={chip.onRemove} aria-label={`Remover filtro ${chip.label}`} className="rounded-full p-0.5 hover:bg-surface">
                <X className="size-3" aria-hidden />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}

      <form
        className="relative"
        onSubmit={(event) => {
          event.preventDefault();
          updateSearch(search);
        }}
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
        <Input aria-label="Buscar pauta" placeholder="Buscar pauta" className="w-56 pl-9" value={search} onChange={(event) => setSearch(event.target.value)} />
      </form>
    </div>
  );
}
