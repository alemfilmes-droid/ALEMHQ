"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ListFilter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface FilterGroup {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

interface FiltersPopoverProps {
  groups: FilterGroup[];
  search?: { key: string; label: string };
}

function readValues(searchParams: URLSearchParams, key: string): string[] {
  const raw = searchParams.get(key);
  return raw ? raw.split(",").filter(Boolean) : [];
}

/** Popover único com filtros de seleção múltipla + busca por texto, tudo na URL. */
export function FiltersPopover({ groups, search }: FiltersPopoverProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [text, setText] = useState(search ? (searchParams.get(search.key) ?? "") : "");
  const [open, setOpen] = useState(false);

  function toggle(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    const current = readValues(params, key);
    const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
    if (next.length === 0) params.delete(key);
    else params.set(key, next.join(","));
    router.replace(`${pathname}?${params.toString()}`);
  }

  function applySearch() {
    if (!search) return;
    const params = new URLSearchParams(searchParams.toString());
    if (text.trim()) params.set(search.key, text.trim());
    else params.delete(search.key);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function clear() {
    const params = new URLSearchParams(searchParams.toString());
    for (const group of groups) params.delete(group.key);
    if (search) params.delete(search.key);
    setText("");
    router.replace(`${pathname}?${params.toString()}`);
  }

  const activeCount =
    groups.reduce((total, group) => total + readValues(searchParams, group.key).length, 0) + (search && searchParams.get(search.key) ? 1 : 0);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary">
          <ListFilter aria-hidden />
          Filtros
          {activeCount > 0 ? <Badge variant="solid">{activeCount}</Badge> : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-h-[70vh] space-y-5 overflow-y-auto">
        {search ? (
          <div className="space-y-2">
            <Label htmlFor="filters-search">{search.label}</Label>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                applySearch();
              }}
            >
              <Input id="filters-search" value={text} onChange={(event) => setText(event.target.value)} onBlur={applySearch} placeholder={search.label} />
            </form>
          </div>
        ) : null}
        {groups.map((group) => {
          const values = readValues(searchParams, group.key);
          return (
            <fieldset key={group.key} className="space-y-2">
              <legend className="eyebrow mb-1">{group.label}</legend>
              <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                {group.options.map((option) => {
                  const id = `${group.key}-${option.value}`;
                  return (
                    <label key={option.value} htmlFor={id} className="flex items-center gap-2 text-sm">
                      <Checkbox id={id} checked={values.includes(option.value)} onCheckedChange={() => toggle(group.key, option.value)} />
                      {option.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}
        {activeCount > 0 ? (
          <Button type="button" variant="ghost" className="w-full" onClick={clear}>
            Limpar filtros
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
