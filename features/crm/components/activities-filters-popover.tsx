"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { INTERACTION_KINDS, INTERACTION_KIND_LABELS } from "@/features/crm/labels";
import type { DealOptionMember } from "@/features/crm/types";

const FILTER_KEYS = ["responsavel", "tipo"] as const;
type FilterKey = (typeof FILTER_KEYS)[number];

function parseList(value: string | null): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

/** Filtro do feed de atividades: responsável do negócio e tipo de atividade. */
export function ActivitiesFiltersPopover({ members }: { members: DealOptionMember[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function getList(key: FilterKey) {
    return parseList(searchParams.get(key));
  }

  function toggleValue(key: FilterKey, value: string) {
    const current = getList(key);
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    const params = new URLSearchParams(searchParams.toString());
    if (next.length === 0) params.delete(key);
    else params.set(key, next.join(","));
    router.replace(`${pathname}?${params.toString()}`);
  }

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of FILTER_KEYS) params.delete(key);
    router.replace(`${pathname}?${params.toString()}`);
  }

  const sections: { key: FilterKey; label: string; items: { id: string; label: string }[] }[] = [
    { key: "responsavel", label: "SDR responsável", items: members.map((m) => ({ id: m.id, label: m.full_name })) },
    { key: "tipo", label: "Tipo", items: INTERACTION_KINDS.map((kind) => ({ id: kind, label: INTERACTION_KIND_LABELS[kind] })) },
  ];

  const activeCount = sections.reduce((total, section) => total + getList(section.key).length, 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="secondary">
          <Filter aria-hidden />
          Filtros
          {activeCount > 0 ? (
            <Badge variant="solid" className="ml-0.5 px-1.5 py-0">
              {activeCount}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold">Filtros</p>
          {activeCount > 0 ? (
            <Button variant="ghost" size="sm" onClick={clearAll} className="h-auto p-0 text-xs font-semibold underline underline-offset-4">
              Limpar filtros
            </Button>
          ) : null}
        </div>
        {sections.map((section) => {
          const selected = getList(section.key);
          return (
            <fieldset key={section.key} className="space-y-2">
              <legend className="eyebrow">{section.label}</legend>
              {section.items.length === 0 ? (
                <p className="text-xs text-subtle">Nada para mostrar.</p>
              ) : (
                <div className="max-h-40 space-y-1.5 overflow-y-auto pr-1">
                  {section.items.map((item) => {
                    const id = `atv-${section.key}-${item.id}`;
                    return (
                      <div key={item.id} className="flex items-center gap-2">
                        <Checkbox id={id} checked={selected.includes(item.id)} onCheckedChange={() => toggleValue(section.key, item.id)} />
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
      </PopoverContent>
    </Popover>
  );
}
