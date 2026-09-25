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
import { DEAL_STAGE_LABELS, DEAL_STAGES, PROSPECTION_GOALS, PROSPECTION_GOAL_LABELS, TEMPERATURES, TEMPERATURE_LABELS } from "@/features/crm/labels";
import { BOARD_PERIOD_KEYS, BOARD_PERIOD_LABELS, type BoardPeriodKey } from "@/features/crm/period";
import type { DealFormOptions } from "@/features/crm/types";
import { COMPANY_SOURCES, SOURCE_LABELS } from "@/lib/domain";
import { cn } from "@/lib/utils";

const LIST_KEYS = ["etapa", "objetivo", "sdr", "responsavel", "origem", "temperatura"] as const;
type ListKey = (typeof LIST_KEYS)[number];
const OTHER_KEYS = ["busca", "valorMin", "valorMax", "periodo", "de", "ate"] as const;

function parseList(value: string | null): string[] {
  return value ? value.split(",").filter(Boolean) : [];
}

/** Um único "Filtros": etapa, objetivo, SDR, responsável atual, origem, temperatura, faixa de valor e período. Tudo na URL. */
export function DealsFiltersPopover({ options }: { options: DealFormOptions }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("busca") ?? "");
  const [minValue, setMinValue] = useState(searchParams.get("valorMin") ?? "");
  const [maxValue, setMaxValue] = useState(searchParams.get("valorMax") ?? "");
  const [from, setFrom] = useState(searchParams.get("de") ?? "");
  const [to, setTo] = useState(searchParams.get("ate") ?? "");
  const period = (searchParams.get("periodo") ?? "mes") as BoardPeriodKey;

  function replaceParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    router.replace(`${pathname}?${params.toString()}`);
  }

  function getList(key: ListKey) {
    return parseList(searchParams.get(key));
  }

  function toggleValue(key: ListKey, value: string) {
    const current = getList(key);
    const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
    replaceParams((params) => (next.length === 0 ? params.delete(key) : params.set(key, next.join(","))));
  }

  function setParam(key: string, value: string) {
    replaceParams((params) => (value.trim() ? params.set(key, value.trim()) : params.delete(key)));
  }

  function setPeriod(key: BoardPeriodKey) {
    replaceParams((params) => {
      if (key === "mes") params.delete("periodo");
      else params.set("periodo", key);
      if (key !== "personalizado") {
        params.delete("de");
        params.delete("ate");
      }
    });
  }

  function applyCustomPeriod() {
    if (!from || !to || from > to) return;
    replaceParams((params) => {
      params.set("periodo", "personalizado");
      params.set("de", from);
      params.set("ate", to);
    });
  }

  function clearAll() {
    replaceParams((params) => {
      for (const key of [...LIST_KEYS, ...OTHER_KEYS]) params.delete(key);
    });
    setSearch("");
    setMinValue("");
    setMaxValue("");
    setFrom("");
    setTo("");
  }

  const sections: { key: ListKey; label: string; items: { id: string; label: string }[] }[] = [
    { key: "etapa", label: "Etapa", items: DEAL_STAGES.map((stage) => ({ id: stage, label: DEAL_STAGE_LABELS[stage] })) },
    { key: "objetivo", label: "Objetivo da prospecção", items: PROSPECTION_GOALS.map((goal) => ({ id: goal, label: PROSPECTION_GOAL_LABELS[goal] })) },
    { key: "sdr", label: "SDR responsável", items: options.members.map((member) => ({ id: member.id, label: member.full_name })) },
    { key: "responsavel", label: "Responsável atual", items: options.members.map((member) => ({ id: member.id, label: member.full_name })) },
    { key: "origem", label: "Origem", items: COMPANY_SOURCES.map((source) => ({ id: source, label: SOURCE_LABELS[source] })) },
    { key: "temperatura", label: "Temperatura (SLA)", items: TEMPERATURES.map((item) => ({ id: item, label: TEMPERATURE_LABELS[item] })) },
  ];

  const chips = sections.flatMap((section) =>
    getList(section.key).map((id) => ({
      key: `${section.key}:${id}`,
      label: section.items.find((item) => item.id === id)?.label ?? id,
      onRemove: () => toggleValue(section.key, id),
    })),
  );

  const activeCount =
    sections.reduce((total, section) => total + getList(section.key).length, 0) +
    (searchParams.get("valorMin") || searchParams.get("valorMax") ? 1 : 0) +
    (searchParams.get("periodo") ? 1 : 0);

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
        <PopoverContent align="start" className="max-h-[70vh] w-80 overflow-y-auto">
          <div className="flex items-center justify-between gap-2 pb-3">
            <p className="text-sm font-bold">Filtros</p>
            {activeCount > 0 ? (
              <Button variant="ghost" size="sm" onClick={clearAll} className="h-auto p-0 text-xs font-semibold underline underline-offset-4">
                Limpar filtros
              </Button>
            ) : null}
          </div>
          <div className="space-y-5">
            <fieldset className="space-y-2">
              <legend className="eyebrow">Período (colunas Ganho e Perdido)</legend>
              <div className="flex flex-wrap gap-1.5">
                {BOARD_PERIOD_KEYS.filter((key) => key !== "personalizado").map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPeriod(key)}
                    aria-pressed={period === key}
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-[13px] font-semibold transition-colors",
                      period === key ? "border-foreground text-foreground" : "border-border text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {BOARD_PERIOD_LABELS[key]}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input aria-label="De" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
                <Input aria-label="Até" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
              </div>
              <Button type="button" size="sm" variant="secondary" onClick={applyCustomPeriod} disabled={!from || !to || from > to}>
                Aplicar período personalizado
              </Button>
            </fieldset>

            {sections.map((section) => {
              const selected = getList(section.key);
              return (
                <fieldset key={section.key} className="space-y-2">
                  <legend className="eyebrow">{section.label}</legend>
                  <div className="max-h-36 space-y-1.5 overflow-y-auto pr-1">
                    {section.items.map((item) => {
                      const id = `filtro-${section.key}-${item.id}`;
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
                </fieldset>
              );
            })}

            <fieldset className="space-y-2">
              <legend className="eyebrow">Faixa de valor (R$)</legend>
              <div className="flex items-center gap-2">
                <Input
                  aria-label="Valor mínimo"
                  placeholder="Mínimo"
                  inputMode="decimal"
                  value={minValue}
                  onChange={(event) => setMinValue(event.target.value)}
                  onBlur={() => setParam("valorMin", minValue)}
                />
                <Input
                  aria-label="Valor máximo"
                  placeholder="Máximo"
                  inputMode="decimal"
                  value={maxValue}
                  onChange={(event) => setMaxValue(event.target.value)}
                  onBlur={() => setParam("valorMax", maxValue)}
                />
              </div>
            </fieldset>
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
          setParam("busca", search);
        }}
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
        <Input aria-label="Buscar negócio" placeholder="Buscar negócio" className="w-56 pl-9" value={search} onChange={(event) => setSearch(event.target.value)} />
      </form>
    </div>
  );
}
