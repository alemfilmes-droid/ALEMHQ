"use client";

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { EventBlock, EventChip } from "@/features/agenda/components/event-block";
import { eventsByDay, layoutDay } from "@/features/agenda/layout";
import type { AgendaEvent } from "@/features/agenda/types";
import { dayMonthShort, isWeekend, minutesInAppZone, todayInAppZone, weekdayShort } from "@/lib/calendar";
import { cn } from "@/lib/utils";

const HOUR_HEIGHT = 48;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);

interface AgendaTimeGridProps {
  days: string[];
  events: AgendaEvent[];
  onOpen: (event: AgendaEvent) => void;
  /** Clique num horário vazio: abre "novo compromisso" naquele dia/hora. */
  onCreateAt?: (day: string, hour: number) => void;
}

function useNowMinutes() {
  const [now, setNow] = useState<{ day: string; minutes: number } | null>(null);
  useEffect(() => {
    const tick = () => setNow({ day: todayInAppZone(), minutes: minutesInAppZone(new Date().toISOString()) });
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/**
 * Grade de horas das visões Semana (7 colunas, seg–dom) e Dia (1 coluna). Fim de semana com um tom
 * neutro levemente diferente; hoje com borda superior de 2px; linha da hora atual no dia de hoje.
 * Eventos que se sobrepõem ficam lado a lado.
 */
export function AgendaTimeGrid({ days, events, onOpen, onCreateAt }: AgendaTimeGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const now = useNowMinutes();
  const byDay = eventsByDay(events);
  const today = now?.day ?? todayInAppZone();
  const single = days.length === 1;
  const columns = { gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` } satisfies CSSProperties;

  // Abre já no horário útil: 1h antes de agora (se hoje estiver na tela) ou às 7h. Só na montagem e
  // quando o intervalo de dias muda (a chave em texto evita rolar de novo a cada re-render).
  const rangeKey = days.join(",");
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const showsToday = rangeKey.split(",").includes(todayInAppZone());
    const minutes = showsToday ? Math.max(minutesInAppZone(new Date().toISOString()) - 60, 0) : 7 * 60;
    element.scrollTop = (minutes / 60) * HOUR_HEIGHT;
  }, [rangeKey]);

  function handleColumnClick(day: string, event: MouseEvent<HTMLDivElement>) {
    if (!onCreateAt || event.target !== event.currentTarget) return;
    const offset = event.nativeEvent.offsetY;
    onCreateAt(day, Math.min(23, Math.max(0, Math.floor(offset / HOUR_HEIGHT))));
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <div className={cn(!single && "min-w-[900px]")}>
        {/* Cabeçalho dos dias */}
        <div className="grid border-b border-border" style={columns}>
          <div />
          {days.map((day) => {
            const count = (byDay.get(day) ?? []).length;
            const isToday = day === today;
            return (
              <div
                key={day}
                className={cn(
                  "min-w-0 border-l border-border px-2 py-2",
                  isWeekend(day) ? "bg-surface-weekend" : "bg-surface",
                  isToday && "border-t-2 border-t-foreground",
                )}
              >
                <p className={cn("text-[11px] font-bold uppercase tracking-wide", isToday ? "text-foreground" : "text-subtle")}>
                  {weekdayShort(day)}
                  {isToday ? " · hoje" : ""}
                </p>
                <p className="flex items-baseline justify-between gap-2">
                  <span className="whitespace-nowrap text-sm font-bold">{dayMonthShort(day)}</span>
                  <span className="text-[11px] font-semibold tabular-nums text-subtle" title={`${count} ${count === 1 ? "compromisso" : "compromissos"}`}>
                    {count}
                  </span>
                </p>
              </div>
            );
          })}
        </div>

        {/* Dia inteiro */}
        <div className="grid border-b border-border" style={columns}>
          <div className="flex items-center justify-end pr-2 text-[10px] font-semibold uppercase text-subtle">Dia todo</div>
          {days.map((day) => {
            const allDay = (byDay.get(day) ?? []).filter((event) => event.allDay);
            return (
              <div key={day} className={cn("min-h-8 min-w-0 space-y-0.5 border-l border-border p-1", isWeekend(day) ? "bg-surface-weekend" : "bg-surface")}>
                {allDay.map((event) => (
                  <EventChip key={event.key} event={event} onOpen={onOpen} />
                ))}
              </div>
            );
          })}
        </div>

        {/* Horas */}
        <div ref={scrollRef} className="max-h-[calc(100dvh-19rem)] min-h-[420px] overflow-y-auto">
          <div className="relative grid" style={columns}>
            <div className="relative" style={{ height: 24 * HOUR_HEIGHT }}>
              {HOURS.map((hour) => (
                <span
                  key={hour}
                  className="absolute right-2 -translate-y-1/2 text-[10px] font-semibold tabular-nums text-subtle"
                  style={{ top: hour * HOUR_HEIGHT }}
                >
                  {hour === 0 ? "" : `${String(hour).padStart(2, "0")}:00`}
                </span>
              ))}
            </div>
            {days.map((day) => {
              const positioned = layoutDay(byDay.get(day) ?? [], day);
              const isToday = day === today;
              return (
                <div
                  key={day}
                  onClick={(event) => handleColumnClick(day, event)}
                  className={cn("relative min-w-0 border-l border-border", onCreateAt && "cursor-cell", isWeekend(day) ? "bg-surface-weekend" : "bg-background")}
                  style={{
                    height: 24 * HOUR_HEIGHT,
                    backgroundImage: `repeating-linear-gradient(to bottom, var(--border) 0, var(--border) 1px, transparent 1px, transparent ${HOUR_HEIGHT}px)`,
                  }}
                >
                  {positioned.map(({ event, start, end, column, columns: total }) => {
                    const height = ((end - start) / 60) * HOUR_HEIGHT;
                    return (
                      <EventBlock
                        key={event.key}
                        event={event}
                        onOpen={onOpen}
                        compact={height < 34}
                        className="absolute"
                        style={{
                          top: (start / 60) * HOUR_HEIGHT + 1,
                          height: height - 2,
                          left: `calc(${(column / total) * 100}% + 2px)`,
                          width: `calc(${100 / total}% - 4px)`,
                        }}
                      />
                    );
                  })}
                  {isToday && now ? (
                    <div aria-hidden className="pointer-events-none absolute inset-x-0 z-10" style={{ top: (now.minutes / 60) * HOUR_HEIGHT }}>
                      <div className="relative h-0.5 bg-foreground">
                        <span className="absolute -left-1 -top-[3px] size-2 rounded-full bg-foreground" />
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
