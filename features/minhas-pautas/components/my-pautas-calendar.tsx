"use client";

import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { ClientAvatar } from "@/components/companies/client-avatar";
import { UserAvatar, usePrimarySquad } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { StatusDot } from "@/components/ui/status-dot";
import { groupPautasByWeek } from "@/features/minhas-pautas/board";
import { FreelancerBadge } from "@/features/pautas/components/freelancer-badge";
import { PautaPriorityBadge } from "@/features/pautas/components/pauta-priority-badge";
import { addDays, dayMonthShort, isWeekend, startOfWeek, timeInAppZone, todayInAppZone, weekRangeLabel, weekdayShort } from "@/lib/calendar";
import { isPautaOverdue } from "@/lib/pautas";
import { SQUAD_TONE } from "@/lib/status";
import { SQUAD_LABELS } from "@/lib/auth/squads";
import { SURFACE, squadBarStyle, squadGradient } from "@/lib/theme";
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
  const assigneeId = pauta.current_assignee_id ?? pauta.lead_id;
  const ownerSquad = usePrimarySquad(pauta.lead_id ?? pauta.created_by) ?? pauta.squad;
  // Degradê na cor do squad da pauta (a origem), igual ao card do quadro.
  const gradient = squadGradient(pauta.squad, 13);

  return (
    <button
      type="button"
      onClick={onOpen}
      style={{ backgroundImage: gradient ? `${gradient}, linear-gradient(180deg, var(--surface-card-from), var(--surface-card-to))` : undefined }}
      className={cn(
        SURFACE.card,
        "calendar-card relative block w-full space-y-2 overflow-hidden rounded-md py-3 pl-4 pr-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
      )}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={squadBarStyle(ownerSquad)} />
      <span className="flex items-center justify-between gap-2 text-[12px] font-semibold text-subtle">
        {pauta.scheduled_at ? (
          <span className="flex items-center gap-1 whitespace-nowrap tabular-nums text-foreground">
            <Clock className="size-3.5" aria-hidden />
            {timeInAppZone(pauta.scheduled_at)}
          </span>
        ) : (
          <span className={cn("whitespace-nowrap", overdue && "text-foreground")}>{overdue ? "Prazo vencido" : "Prazo"}</span>
        )}
        {showSquad && pauta.squad ? <StatusDot tone={SQUAD_TONE[pauta.squad]} label={SQUAD_LABELS[pauta.squad]} /> : null}
      </span>
      <span className="line-clamp-3 block text-sm font-semibold leading-snug">{pauta.title}</span>
      <span className="flex items-center gap-1.5 text-[12px] text-subtle">
        <ClientAvatar
          name={pauta.project_is_internal || !pauta.company_name ? "Além Filmes" : pauta.company_name}
          logoUrl={pauta.project_is_internal ? null : pauta.company_logo_url}
          size="sm"
          className="size-5 text-[8px]"
        />
        <span className="min-w-0 flex-1 truncate">{pauta.is_standalone ? "Tarefa avulsa" : pauta.project_is_internal ? "Interno" : (pauta.company_name ?? "—")}</span>
        {assigneeId ? (
          <UserAvatar
            name={(pauta.current_assignee_id ? pauta.assignee_name : pauta.lead_name) ?? "—"}
            src={pauta.current_assignee_id ? pauta.assignee_avatar_url : pauta.lead_avatar_url}
            profileId={assigneeId}
            className="size-5 text-[8px]"
          />
        ) : null}
      </span>
      {pauta.priority === "alta" || pauta.priority === "urgente" || pauta.freelancer_name ? (
        <span className="flex flex-wrap gap-1">
          {pauta.priority === "alta" || pauta.priority === "urgente" ? <PautaPriorityBadge priority={pauta.priority} /> : null}
          {pauta.freelancer_name ? <FreelancerBadge name={pauta.freelancer_name} /> : null}
        </span>
      ) : null}
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
        <div className="grid min-w-[1120px] grid-cols-7 gap-3">
          {days.map((day) => {
            const isToday = day.date === today;
            const count = day.timed.length + day.untimed.length;
            return (
              <section
                key={day.date}
                aria-label={`${weekdayShort(day.date)}, ${dayMonthShort(day.date)}: ${count} ${count === 1 ? "item" : "itens"}`}
                className={cn(
                  "calendar-day relative flex min-h-[560px] min-w-0 flex-col overflow-hidden rounded-lg border",
                  isWeekend(day.date) ? "bg-surface-weekend" : "bg-surface",
                  isToday && "calendar-day-today",
                )}
              >
                {isToday ? <span aria-hidden className="absolute inset-x-0 top-0 h-[2px] bg-brand-accent" /> : null}
                <header className="flex items-baseline justify-between gap-2 border-b border-border px-4 py-3.5">
                  <span className="min-w-0">
                    <span className={cn("block text-[11px] font-bold uppercase tracking-wide", isToday ? "text-brand-accent" : "text-subtle")}>
                      {weekdayShort(day.date)}
                      {isToday ? " · hoje" : ""}
                    </span>
                    <span className="block whitespace-nowrap text-base font-bold">{dayMonthShort(day.date)}</span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-subtle" title={`${count} ${count === 1 ? "item" : "itens"}`}>
                    {count}
                  </span>
                </header>
                <div className="flex-1 space-y-2.5 p-3">
                  {count === 0 ? <p className="px-1 py-6 text-center text-[12px] text-subtle">Livre.</p> : null}
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
