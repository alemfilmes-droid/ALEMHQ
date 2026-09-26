"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PERIOD_KEYS, PERIOD_LABELS, endOfMonthISO, type Period, type PeriodKey } from "@/features/finance/period";
import { formatDateShort } from "@/lib/format";
import { cn } from "@/lib/utils";

const PRESET_KEYS = PERIOD_KEYS.filter((key): key is Exclude<PeriodKey, "personalizado"> => key !== "personalizado");

/**
 * Um único Popover controla tudo (atalhos + intervalo customizado). Fecha explicitamente ao
 * confirmar, e o Radix já fecha sozinho em Esc / clique fora.
 *
 * Datas futuras: os dois campos aceitam QUALQUER data (antes o "De" tinha `max` = "Até", que por
 * padrão é o fim do mês atual — por isso nenhum mês futuro podia ser escolhido). Agora não há
 * min/max cruzado: se o "De" passar do "Até", o "Até" acompanha (fim do mês do "De").
 */
export function PeriodSelector({ period }: { period: Period }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(period.from);
  const [draftTo, setDraftTo] = useState(period.to);

  // Reabrir sempre parte do período atual, nunca de um rascunho velho de uma abertura anterior.
  useEffect(() => {
    if (open) {
      setDraftFrom(period.from);
      setDraftTo(period.to);
    }
  }, [open, period.from, period.to]);

  function navigate(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  function applyPreset(key: Exclude<PeriodKey, "personalizado">) {
    navigate({ periodo: key === "mes" ? null : key, de: null, ate: null });
    setOpen(false);
  }

  function applyCustom() {
    if (!draftFrom || !draftTo || draftFrom > draftTo) return;
    navigate({ periodo: "personalizado", de: draftFrom, ate: draftTo });
    setOpen(false);
  }

  function clear() {
    navigate({ periodo: null, de: null, ate: null });
    setOpen(false);
  }

  const invalidRange = !draftFrom || !draftTo || draftFrom > draftTo;
  const label = period.key === "personalizado" ? `${formatDateShort(period.from)} – ${formatDateShort(period.to)}` : PERIOD_LABELS[period.key];

  return (
    <div className="space-y-2 sm:w-72">
      <Label htmlFor="period-trigger">Período</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id="period-trigger" type="button" variant="secondary" className="w-full justify-between font-normal">
            <span className="flex items-center gap-2 truncate">
              <CalendarRange className="size-4 shrink-0 text-subtle" aria-hidden />
              <span className="truncate">{label}</span>
            </span>
            <ChevronDown className="size-4 shrink-0 text-subtle" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 space-y-4">
          <fieldset className="space-y-1">
            <legend className="eyebrow mb-1">Atalhos</legend>
            {PRESET_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => applyPreset(key)}
                className={cn(
                  "block w-full rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-surface-hover",
                  period.key === key ? "bg-surface-hover font-bold text-foreground" : "text-muted-foreground",
                )}
                aria-current={period.key === key || undefined}
              >
                {PERIOD_LABELS[key]}
              </button>
            ))}
          </fieldset>

          <div className="space-y-3 border-t border-border pt-3">
            <p className="eyebrow">Personalizado</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="period-from">De</Label>
                <Input
                  id="period-from"
                  type="date"
                  value={draftFrom}
                  onChange={(event) => {
                    const next = event.target.value;
                    setDraftFrom(next);
                    if (next && draftTo && next > draftTo) setDraftTo(endOfMonthISO(next));
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="period-to">Até</Label>
                <Input
                  id="period-to"
                  type="date"
                  value={draftTo}
                  onChange={(event) => setDraftTo(event.target.value)}
                  aria-invalid={Boolean(draftFrom && draftTo && draftFrom > draftTo) || undefined}
                />
              </div>
            </div>
            {draftFrom && draftTo && draftFrom > draftTo ? (
              <p className="text-[12px] font-semibold text-foreground">O fim precisa ser depois do início.</p>
            ) : null}
            <Button type="button" size="sm" className="w-full" onClick={applyCustom} disabled={invalidRange}>
              Aplicar
            </Button>
          </div>

          {period.key !== "mes" ? (
            <Button type="button" variant="ghost" size="sm" className="w-full" onClick={clear}>
              Limpar
            </Button>
          ) : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}
