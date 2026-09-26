"use client";

import { useEffect, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { EventBlock, EventChip } from "@/features/agenda/components/event-block";
import { eventsByDay, layoutDay } from "@/features/agenda/layout";
import type { AgendaEvent } from "@/features/agenda/types";
import { dayMonthShort, isWeekend, minutesInAppZone, todayInAppZone, weekdayShort } from "@/lib/calendar";
import { cn } from "@/lib/utils";

const HOUR_HEIGHT = 56;
const DAY_HEIGHT = 24 * HOUR_HEIGHT;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
/** Altura mínima de um bloco: sempre cabe uma linha de texto. */
const MIN_BLOCK_PX = 24;
const GUTTER = "4rem";

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

function hourLabel(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

/**
 * Grade de horas das visões Semana (7 colunas, seg–dom) e Dia (1 coluna), em CSS grid.
 *
 * Por que não desalinha mais: cabeçalho, faixa "dia todo" e corpo vivem no MESMO contêiner de
 * rolagem e usam o MESMO `grid-template-columns` (calha fixa de horas + colunas iguais). Antes o
 * corpo rolava num contêiner próprio — a barra de rolagem roubava largura só dele e as colunas
 * escorregavam em relação ao cabeçalho. Agora o cabeçalho é `sticky` no topo e a calha de horas é
 * `sticky` à esquerda (rolagem horizontal no celular).
 *
 * Eventos: posicionados em absoluto dentro da própria coluna, com altura mínima e texto truncado;
 * simultâneos ficam lado a lado (layoutDay). Linha da hora atual no dia de hoje, no acento da marca.
 */
export function AgendaTimeGrid({ days, events, onOpen, onCreateAt }: AgendaTimeGridProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const now = useNowMinutes();
  const byDay = eventsByDay(events);
  const today = now?.day ?? todayInAppZone();
  const single = days.length === 1;
  const columns = { gridTemplateColumns: `${GUTTER} repeat(${days.length}, minmax(0, 1fr))` } satisfies CSSProperties;
  const showsToday = days.includes(today);

  // Abre já no horário útil: 1h antes de agora (se hoje estiver na tela) ou às 7h. Só na montagem e
  // quando o intervalo de dias muda (a chave em texto evita rolar de novo a cada re-render).
  const rangeKey = days.join(",");
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const hasToday = rangeKey.split(",").includes(todayInAppZone());
    const minutes = hasToday ? Math.max(minutesInAppZone(new Date().toISOString()) - 60, 0) : 7 * 60;
    element.scrollTop = (minutes / 60) * HOUR_HEIGHT;
  }, [rangeKey]);

  function handleColumnClick(day: string, event: MouseEvent<HTMLDivElement>) {
    if (!onCreateAt || event.target !== event.currentTarget) return;
    const offset = event.nativeEvent.offsetY;
    onCreateAt(day, Math.min(23, Math.max(0, Math.floor(offset / HOUR_HEIGHT))));
  }

  return (
    <div
      ref={scrollRef}
      className="relative max-h-[calc(100dvh-19rem)] min-h-[480px] overflow-auto overscroll-contain rounded-lg border border-border bg-background"
    >
      <div className={cn(!single && "min-w-[840px]")}>
        {/* Cabeçalho + dia inteiro: fixos no topo durante a rolagem vertical. */}
        <div className="sticky top-0 z-20 border-b border-border bg-surface">
          <div className="grid" style={columns}>
            <div className="sticky left-0 z-10 bg-surface" />
            {days.map((day) => {
              const count = (byDay.get(day) ?? []).length;
              const isToday = day === today;
              return (
                <div
                  key={day}
                  className={cn("relative min-w-0 border-l border-border px-3 py-2.5", isWeekend(day) ? "bg-surface-weekend" : "bg-surface")}
                >
                  {isToday ? <span aria-hidden className="absolute inset-x-0 top-0 h-[2px] bg-brand-accent" /> : null}
                  <p className={cn("truncate text-[11px] font-bold uppercase tracking-wide", isToday ? "text-brand-accent" : "text-subtle")}>
                    {weekdayShort(day)}
                    {isToday ? " · hoje" : ""}
                  </p>
                  <p className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-bold">{dayMonthShort(day)}</span>
                    <span className="shrink-0 text-[11px] font-semibold tabular-nums text-subtle" title={`${count} ${count === 1 ? "compromisso" : "compromissos"}`}>
                      {count}
                    </span>
                  </p>
                </div>
              );
            })}
          </div>

          <div className="grid border-t border-border" style={columns}>
            <div className="sticky left-0 z-10 flex items-center justify-end bg-surface pr-2 text-[10px] font-semibold uppercase leading-tight text-subtle">
              Dia todo
            </div>
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
        </div>

        {/* Corpo: calha de horas (fixa à esquerda) + uma coluna por dia, todas com a mesma altura. */}
        <div className="grid" style={columns}>
          <div className="sticky left-0 z-10 border-r border-border bg-background" style={{ height: DAY_HEIGHT }}>
            <div className="relative h-full">
              {HOURS.slice(1).map((hour) => (
                <span
                  key={hour}
                  className="absolute right-2 -translate-y-1/2 text-[11px] font-semibold tabular-nums text-subtle"
                  style={{ top: hour * HOUR_HEIGHT }}
                >
                  {hourLabel(hour)}
                </span>
              ))}
              {showsToday && now ? (
                <span
                  aria-hidden
                  className="absolute right-1.5 z-10 -translate-y-1/2 rounded-sm bg-background px-0.5 text-[10px] font-bold tabular-nums text-brand-accent"
                  style={{ top: (now.minutes / 60) * HOUR_HEIGHT }}
                >
                  {String(Math.floor(now.minutes / 60)).padStart(2, "0")}:{String(now.minutes % 60).padStart(2, "0")}
                </span>
              ) : null}
            </div>
          </div>

          {days.map((day) => {
            const positioned = layoutDay(byDay.get(day) ?? [], day);
            const isToday = day === today;
            return (
              <div
                key={day}
                onClick={(event) => handleColumnClick(day, event)}
                className={cn(
                  "relative min-w-0 overflow-hidden border-l border-border",
                  onCreateAt && "cursor-cell",
                  isWeekend(day) ? "bg-surface-weekend" : "bg-background",
                )}
                style={{
                  height: DAY_HEIGHT,
                  // Linha cheia a cada hora e tracejado leve na meia hora.
                  backgroundImage: `repeating-linear-gradient(to bottom, var(--border) 0, var(--border) 1px, transparent 1px, transparent ${HOUR_HEIGHT}px), repeating-linear-gradient(to bottom, transparent 0, transparent ${HOUR_HEIGHT / 2}px, color-mix(in srgb, var(--border) 45%, transparent) ${HOUR_HEIGHT / 2}px, color-mix(in srgb, var(--border) 45%, transparent) ${HOUR_HEIGHT / 2 + 1}px, transparent ${HOUR_HEIGHT / 2 + 1}px, transparent ${HOUR_HEIGHT}px)`,
                }}
              >
                {positioned.map(({ event, start, end, column, columns: total }) => {
                  const height = Math.max(((end - start) / 60) * HOUR_HEIGHT - 2, MIN_BLOCK_PX);
                  return (
                    <EventBlock
                      key={event.key}
                      event={event}
                      onOpen={onOpen}
                      compact={height < 44}
                      className="absolute"
                      style={{
                        top: (start / 60) * HOUR_HEIGHT + 1,
                        height,
                        left: `calc(${(column / total) * 100}% + 2px)`,
                        width: `calc(${100 / total}% - 4px)`,
                        zIndex: 1 + column,
                      }}
                    />
                  );
                })}
                {isToday && now ? (
                  <div aria-hidden className="pointer-events-none absolute inset-x-0 z-10" style={{ top: (now.minutes / 60) * HOUR_HEIGHT }}>
                    <div className="relative h-0.5 bg-brand-accent shadow-[0_0_8px_var(--accent-glow)]">
                      <span className="absolute -left-1 -top-[3px] size-2 rounded-full bg-brand-accent" />
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
