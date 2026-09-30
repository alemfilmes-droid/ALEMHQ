"use client";

import { CalendarX2, Lock, MapPin, Repeat, Users } from "lucide-react";
import { ClientAvatar } from "@/components/companies/client-avatar";
import { StatusBar } from "@/components/ui/status-bar";
import { eventTimeLabel, eventsByDay } from "@/features/agenda/layout";
import type { AgendaEvent } from "@/features/agenda/types";
import { COMMITMENT_KIND_LABELS } from "@/features/crm/labels";
import { dayMonthShort, todayInAppZone, weekdayLong } from "@/lib/calendar";
import { COMMITMENT_KIND_TONE } from "@/lib/status";
import { cn } from "@/lib/utils";

/** Visão "Agenda": lista por dia dos próximos 30 dias a partir da data escolhida. */
export function AgendaList({ events, onOpen }: { events: AgendaEvent[]; onOpen: (event: AgendaEvent) => void }) {
  const today = todayInAppZone();
  const byDay = [...eventsByDay(events).entries()].sort(([a], [b]) => a.localeCompare(b));

  if (byDay.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-lg border border-dashed border-border-strong px-6 py-16 text-center">
        <CalendarX2 className="mb-3 size-6 text-muted-foreground" aria-hidden />
        <p className="font-bold">Nenhum compromisso nestes 30 dias.</p>
        <p className="mt-1 text-sm text-muted-foreground">Ajuste os filtros ou crie um compromisso.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {byDay.map(([day, list]) => (
        <section key={day} aria-labelledby={`dia-${day}`} className="space-y-2">
          <h2 id={`dia-${day}`} className={cn("flex items-baseline gap-2 text-sm font-bold", day === today && "text-foreground")}>
            <span className="capitalize">{weekdayLong(day)}</span>
            <span className="font-normal text-muted-foreground">{dayMonthShort(day)}</span>
            {day === today ? <span className="eyebrow">Hoje</span> : null}
            <span className="ml-auto text-xs font-semibold text-subtle">{list.length}</span>
          </h2>
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {list.map((event) => (
              <li key={event.key}>
                <button
                  type="button"
                  onClick={event.busyOnly ? undefined : () => onOpen(event)}
                  aria-disabled={event.busyOnly || undefined}
                  className={cn(
                    "relative flex w-full flex-wrap items-center gap-x-4 gap-y-1 py-3 pl-5 pr-4 text-left",
                    event.busyOnly ? "cursor-default text-subtle" : "transition-colors hover:bg-surface-hover",
                  )}
                >
                  <StatusBar tone={event.busyOnly ? "neutral" : COMMITMENT_KIND_TONE[event.kind]} side="left" />
                  <span className="w-28 shrink-0 whitespace-nowrap text-[13px] font-semibold tabular-nums">{eventTimeLabel(event)}</span>
                  <span className="flex min-w-0 flex-1 basis-56 items-center gap-2">
                    {event.companyName ? <ClientAvatar name={event.companyName} logoUrl={event.companyLogoUrl} size="sm" /> : null}
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 truncate text-sm font-semibold">
                        {event.busyOnly ? <Lock className="size-3.5 shrink-0" aria-hidden /> : null}
                        {event.recurrenceRule && !event.busyOnly ? <Repeat className="size-3.5 shrink-0 text-subtle" aria-hidden /> : null}
                        <span className="truncate">{event.busyOnly ? `Ocupado — ${event.ownerName}` : event.title}</span>
                      </span>
                      {!event.busyOnly ? (
                        <span className="block truncate text-[12px] text-subtle">
                          {event.source === "pauta" ? (event.kind === "entrega" ? "Prazo de pauta" : "Pauta") : COMMITMENT_KIND_LABELS[event.kind]}
                          {event.companyName ? ` · ${event.companyName}` : ""}
                          {event.projectName ? ` · ${event.projectName}` : ""}
                        </span>
                      ) : null}
                    </span>
                  </span>
                  {!event.busyOnly ? (
                    <span className="flex shrink-0 items-center gap-3 text-[12px] text-subtle">
                      {event.attendees.length + event.externalAttendees.length > 0 ? (
                        <span className="flex items-center gap-1">
                          <Users className="size-3.5" aria-hidden />
                          {event.attendees.length + event.externalAttendees.length + 1}
                        </span>
                      ) : null}
                      {event.location ? (
                        <span className="flex max-w-48 items-center gap-1 truncate">
                          <MapPin className="size-3.5 shrink-0" aria-hidden />
                          <span className="truncate">{event.location}</span>
                        </span>
                      ) : null}
                      <span>{event.ownerName}</span>
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
