import Link from "next/link";
import { CalendarClock, ChevronRight } from "lucide-react";
import { CardContent, CardHeading } from "@/components/ui/card";
import { StatusBar } from "@/components/ui/status-bar";
import { eventTimeLabel } from "@/features/agenda/layout";
import { getUpcomingAgenda } from "@/features/agenda/queries";
import { COMMITMENT_KIND_LABELS } from "@/features/crm/labels";
import { addDays, dateInAppZone, dayMonthShort, todayInAppZone, weekdayShort } from "@/lib/calendar";
import { COMMITMENT_KIND_TONE } from "@/lib/status";
import { cn } from "@/lib/utils";

function dayLabel(day: string, today: string): { text: string; highlight: boolean } {
  if (day === today) return { text: "Hoje", highlight: true };
  if (day === addDays(today, 1)) return { text: "Amanhã", highlight: true };
  return { text: `${weekdayShort(day)}, ${dayMonthShort(day)}`, highlight: false };
}

/**
 * Próximos 3 compromissos da pessoa (dono ou participante) — vêm do mesmo feed da Agenda, então
 * incluem as pautas agendadas em que ela é líder ou responsável. Hoje e amanhã em destaque.
 */
export async function HomeAgendaCard() {
  const events = await getUpcomingAgenda(3);
  const today = todayInAppZone();

  return (
    <div className="card-surface flex h-full flex-col rounded-lg">
      <CardHeading
        icon={CalendarClock}
        tone="slate"
        title={
          <Link href="/agenda" className="hover:text-foreground hover:underline">
            Próximos compromissos
          </Link>
        }
      />
      <CardContent className="space-y-3">
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum compromisso agendado.</p>
        ) : (
          <ul className="space-y-2">
            {events.map((event) => {
              const day = dateInAppZone(event.startsAt);
              const label = dayLabel(day, today);
              return (
                <li key={event.key}>
                  <Link
                    href={`/agenda?visao=dia&data=${day}${event.commitmentId ? `&compromisso=${event.commitmentId}` : ""}`}
                    className="relative block rounded-md border border-border py-2 pl-4 pr-3 transition-colors hover:bg-surface-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <StatusBar tone={COMMITMENT_KIND_TONE[event.kind]} side="left" />
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{event.title}</span>
                      <span className={cn("shrink-0 whitespace-nowrap text-[12px]", label.highlight ? "font-bold text-foreground" : "text-subtle")}>{label.text}</span>
                    </span>
                    <span className="block truncate text-[12px] text-subtle">
                      {eventTimeLabel(event)} · {event.source === "google" ? "Google Agenda" : event.source === "pauta" ? (event.kind === "entrega" ? "Prazo de pauta" : "Pauta") : COMMITMENT_KIND_LABELS[event.kind]}
                      {event.companyName ? ` · ${event.companyName}` : ""}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <Link href="/agenda" className="inline-flex items-center gap-1 text-sm font-semibold underline underline-offset-4 hover:text-muted-foreground">
          Abrir a agenda
          <ChevronRight className="size-3.5" aria-hidden />
        </Link>
      </CardContent>
    </div>
  );
}
