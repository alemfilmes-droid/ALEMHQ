"use client";

import { EventChip } from "@/features/agenda/components/event-block";
import { eventsByDay } from "@/features/agenda/layout";
import type { AgendaEvent } from "@/features/agenda/types";
import { addDays, isWeekend, todayInAppZone, weekdayShort } from "@/lib/calendar";
import { cn } from "@/lib/utils";

const MAX_PER_DAY = 3;

interface AgendaMonthProps {
  /** Segunda-feira da primeira linha. */
  gridStart: string;
  /** Mês em foco (yyyy-mm) — dias de fora ficam apagados. */
  month: string;
  events: AgendaEvent[];
  onOpen: (event: AgendaEvent) => void;
  onOpenDay: (day: string) => void;
}

/** Mês em 6 semanas de segunda a domingo. Até 3 eventos por dia; o resto abre a visão do dia. */
export function AgendaMonth({ gridStart, month, events, onOpen, onOpenDay }: AgendaMonthProps) {
  const today = todayInAppZone();
  const byDay = eventsByDay(events);
  const days = Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-7 border-b border-border">
          {days.slice(0, 7).map((day) => (
            <p key={day} className={cn("px-2 py-2 text-[11px] font-bold uppercase tracking-wide text-subtle", isWeekend(day) ? "bg-surface-weekend" : "bg-surface")}>
              {weekdayShort(day)}
            </p>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const list = byDay.get(day) ?? [];
            const outside = day.slice(0, 7) !== month;
            const isToday = day === today;
            return (
              <div
                key={day}
                className={cn(
                  "min-h-28 min-w-0 border-b border-l border-border p-1.5 [&:nth-child(7n+1)]:border-l-0",
                  isWeekend(day) ? "bg-surface-weekend" : "bg-background",
                  isToday && "border-t-2 border-t-foreground",
                )}
              >
                <div className="mb-1 flex items-center justify-between gap-1 px-1">
                  <button
                    type="button"
                    onClick={() => onOpenDay(day)}
                    className={cn(
                      "rounded-sm text-[12px] font-bold tabular-nums hover:underline",
                      outside ? "text-subtle" : "text-foreground",
                    )}
                    aria-label={`Abrir o dia ${day.split("-").reverse().join("/")}`}
                  >
                    {Number(day.slice(8, 10))}
                  </button>
                  {list.length > 0 ? <span className="text-[10px] font-semibold tabular-nums text-subtle">{list.length}</span> : null}
                </div>
                <div className={cn("space-y-0.5", outside && "opacity-60")}>
                  {list.slice(0, MAX_PER_DAY).map((event) => (
                    <EventChip key={event.key} event={event} onOpen={onOpen} />
                  ))}
                  {list.length > MAX_PER_DAY ? (
                    <button type="button" onClick={() => onOpenDay(day)} className="px-2 text-[11px] font-semibold text-muted-foreground hover:text-foreground">
                      +{list.length - MAX_PER_DAY} mais
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
