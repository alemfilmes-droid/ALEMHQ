"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilterPopover, UrlSearchInput, type FilterSection } from "@/components/filters/filter-popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEAL_STAGE_LABELS, DEAL_STAGES, PROSPECTION_GOALS, PROSPECTION_GOAL_LABELS, TEMPERATURES, TEMPERATURE_LABELS } from "@/features/crm/labels";
import { BOARD_PERIOD_KEYS, BOARD_PERIOD_LABELS, type BoardPeriodKey } from "@/features/crm/period";
import type { DealFormOptions } from "@/features/crm/types";
import { COMPANY_SOURCES, SOURCE_LABELS } from "@/lib/domain";
import { DEAL_STAGE_TONE, TEMPERATURE_TONE } from "@/lib/status";
import { cn } from "@/lib/utils";

const EXTRA_KEYS = ["valorMin", "valorMax", "periodo", "de", "ate"] as const;

/** Um único "Filtros": etapa, objetivo, SDR, responsável atual, origem, temperatura, faixa de valor e período. Tudo na URL. */
export function DealsFiltersPopover({ options }: { options: DealFormOptions }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [minValue, setMinValue] = useState(searchParams.get("valorMin") ?? "");
  const [maxValue, setMaxValue] = useState(searchParams.get("valorMax") ?? "");
  const [from, setFrom] = useState(searchParams.get("de") ?? "");
  const [to, setTo] = useState(searchParams.get("ate") ?? "");
  const period = (searchParams.get("periodo") ?? "mes") as BoardPeriodKey;

  function replaceParams(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
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

  const people = options.members.map((member) => ({ value: member.id, label: member.full_name }));
  const sections: FilterSection[] = [
    { key: "etapa", label: "Etapa", options: DEAL_STAGES.map((stage) => ({ value: stage, label: DEAL_STAGE_LABELS[stage], tone: DEAL_STAGE_TONE[stage] })) },
    { key: "objetivo", label: "Objetivo da prospecção", options: PROSPECTION_GOALS.map((goal) => ({ value: goal, label: PROSPECTION_GOAL_LABELS[goal] })) },
    { key: "sdr", label: "SDR responsável", options: people },
    { key: "responsavel", label: "Responsável atual", options: people },
    { key: "origem", label: "Origem", options: COMPANY_SOURCES.map((source) => ({ value: source, label: SOURCE_LABELS[source] })) },
    { key: "temperatura", label: "Temperatura (SLA)", options: TEMPERATURES.map((item) => ({ value: item, label: TEMPERATURE_LABELS[item], tone: TEMPERATURE_TONE[item] })) },
  ];

  const extraActiveCount = (searchParams.get("valorMin") || searchParams.get("valorMax") ? 1 : 0) + (searchParams.get("periodo") ? 1 : 0);

  const extra = (
    <>
      <fieldset className="space-y-2">
        <legend className="eyebrow mb-2">Período (colunas Ganho e Perdido)</legend>
        <div className="flex flex-wrap gap-1.5">
          {BOARD_PERIOD_KEYS.filter((key) => key !== "personalizado").map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriod(key)}
              aria-pressed={period === key}
              className={cn(
                "rounded-md border px-2.5 py-1 text-[13px] font-semibold transition-colors",
                period === key ? "border-brand-accent/60 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {BOARD_PERIOD_LABELS[key]}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input aria-label="De" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
          <Input aria-label="Até" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        <Button type="button" size="sm" variant="secondary" className="w-full" onClick={applyCustomPeriod} disabled={!from || !to || from > to}>
          Aplicar período personalizado
        </Button>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="eyebrow mb-2">Faixa de valor (R$)</legend>
        <div className="grid grid-cols-2 gap-2">
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
    </>
  );

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <UrlSearchInput label="Buscar negócio" />
      <FilterPopover
        sections={sections}
        extra={extra}
        extraActiveCount={extraActiveCount}
        extraKeys={EXTRA_KEYS}
        onClear={() => {
          setMinValue("");
          setMaxValue("");
          setFrom("");
          setTo("");
        }}
      />
    </div>
  );
}
