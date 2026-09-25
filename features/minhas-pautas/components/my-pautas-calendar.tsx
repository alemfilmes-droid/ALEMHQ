"use client";

import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { ClientAvatar } from "@/components/companies/client-avatar";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import { groupPautasByWeek } from "@/features/minhas-pautas/board";
import { PautaPriorityBadge } from "@/features/pautas/components/pauta-priority-badge";
import { addDays, dayMonthShort, isWeekend, startOfWeek, timeInAppZone, todayInAppZone, weekRangeLabel, weekdayShort } from "@/lib/calendar";
import { isPautaOverdue } from "@/lib/pautas";
import { SQUAD_TONE } from "@/lib/status";
import { SQUAD_LABELS } from "@/lib/auth/squads";
import { cn } from "@/lib/utils";
import type { PautaWithDetails } from "@/types";

interface MyPautasCalendarProps {
  pautas: PautaWithDetails[];
  /** Segunda-feira da semana exibida (yyyy-mm-dd). */
  monday: string;
  onWeekChange: (monday: string) => void;
  onOpen: (id: string) => void;
  showSquad: boolean;
}

function CalendarItem({ pauta, onOpen, showSquad }: { pauta: PautaWithDetails; onOpen: () => void; showSquad: boolean }) {
  const overdue = !pauta.scheduled_at && pauta.due_date ? isPautaOverdue(pauta.due_date, pauta.board_column!) : false;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full space-y-1.5 rounded-md border border-border bg-card p-2.5 text-left transition-colors hover:border-border-strong hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
    >
      <span className="flex items-center justify-between gap-2 text-[11px] font-semibold text-subtle">
        {pauta.scheduled_at ? (
          <span className="flex items-center gap-1 whitespace-nowrap tabular-nums text-foreground">
            <Clock className="size-3" aria-hidden />
            {timeInAppZone(pauta.scheduled_at)}
          </span>
        ) : (
          <span className={cn("whitespace-nowrap", overdue && "text-foreground")}>{overdue ? "Prazo vencido" : "Prazo"}</span>
        )}
        {showSquad && pauta.squad ? <StatusDot tone={SQUAD_TONE[pauta.squad]} label={SQUAD_LABELS[pauta.squad]} /> : null}
      </span>
      <span className="line-clamp-2 block text-[13px] font-semibold leading-snug">{pauta.title}</span>
      <span className="flex items-center gap-1.5 text-[11px] text-subtle">
        <ClientAvatar
          name={pauta.project_is_internal || !pauta.company_name ? "Além Filmes" : pauta.company_name}
          logoUrl={pauta.project_is_internal ? null : pauta.company_logo_url}
          size="sm"
          className="size-4 text-[7px]"
        />
        <span className="truncate">{pauta.is_standalone ? "Tarefa avulsa" : pauta.project_is_internal ? "Interno" : (pauta.company_name ?? "—")}</span>
      </span>
      {pauta.priority === "alta" || pauta.priority === "urgente" ? <PautaPriorityBadge priority={pauta.priority} /> : null}
    </button>
  );
}

/**
 * Semana fixa de segunda a domingo — sempre 7 colunas (no celular a grade rola na horizontal, a
 * página não). Com horário primeiro, por hora; depois o que só tem prazo, por prioridade.
 */
export function MyPautasCalendar({ pautas, monday, onWeekChange, onOpen, showSquad }: MyPautasCalendarProps) {
  const today = todayInAppZone();
  const days = groupPautasByWeek(pautas, monday);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="icon" className="size-8" onClick={() => onWeekChange(addDays(monday, -7))} aria-label="Semana anterior">
            <ChevronLeft aria-hidden />
          </Button>
          <Button variant="secondary" size="icon" className="size-8" onClick={() => onWeekChange(addDays(monday, 7))} aria-label="Próxima semana">
            <ChevronRight aria-hidden />
          </Button>
        </div>
        <Button variant="secondary" size="sm" onClick={() => onWeekChange(startOfWeek(today))} disabled={monday === startOfWeek(today)}>
          Hoje
        </Button>
        <p className="ml-1 text-sm font-bold" aria-live="polite">
          {weekRangeLabel(monday)}
        </p>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="grid min-w-[980px] grid-cols-7 gap-2">
          {days.map((day) => {
            const isToday = day.date === today;
            const count = day.timed.length + day.untimed.length;
            return (
              <section
                key={day.date}
                aria-label={`${weekdayShort(day.date)}, ${dayMonthShort(day.date)}: ${count} ${count === 1 ? "item" : "itens"}`}
                className={cn(
                  "flex min-h-[420px] min-w-0 flex-col rounded-lg border border-border",
                  isWeekend(day.date) ? "bg-surface-weekend" : "bg-surface",
                  isToday && "border-t-2 border-t-foreground",
                )}
              >
                <header className="flex items-baseline justify-between gap-2 border-b border-border px-3 py-2.5">
                  <span className="min-w-0">
                    <span className={cn("block text-[11px] font-bold uppercase tracking-wide", isToday ? "text-foreground" : "text-subtle")}>
                      {weekdayShort(day.date)}
                      {isToday ? " · hoje" : ""}
                    </span>
                    <span className="block whitespace-nowrap text-sm font-bold">{dayMonthShort(day.date)}</span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-subtle" title={`${count} ${count === 1 ? "item" : "itens"}`}>
                    {count}
                  </span>
                </header>
                <div className="flex-1 space-y-2 p-2">
                  {count === 0 ? <p className="px-1 py-4 text-center text-[11px] text-subtle">Livre.</p> : null}
                  {day.timed.map((pauta) => (
                    <CalendarItem key={pauta.id} pauta={pauta} onOpen={() => onOpen(pauta.id!)} showSquad={showSquad} />
                  ))}
                  {day.timed.length > 0 && day.untimed.length > 0 ? <hr className="border-dashed border-border" /> : null}
                  {day.untimed.map((pauta) => (
                    <CalendarItem key={pauta.id} pauta={pauta} onOpen={() => onOpen(pauta.id!)} showSquad={showSquad} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
