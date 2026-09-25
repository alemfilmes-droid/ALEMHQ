import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EntryRowActions } from "@/features/time-tracking/components/entry-row-actions";
import { formatDayMonth, formatMinutes, formatTime } from "@/features/time-tracking/format";
import type { ExtractDay } from "@/features/time-tracking/types";
import { toneColor } from "@/lib/status";
import { cn } from "@/lib/utils";

export function ExtractList({ days, readOnly = false }: { days: ExtractDay[]; readOnly?: boolean }) {
  if (days.length === 0) {
    return <p className="rounded-lg border border-border bg-card p-6 text-sm text-subtle">Nenhum dia neste mês.</p>;
  }

  return (
    <ul className="space-y-4" aria-label="Extrato por dia">
      {days.map((day) => (
        <li
          key={day.workDate}
          className={cn(
            "rounded-lg border border-border bg-card p-4",
            !day.hasRecord && "opacity-60",
            day.relativeLabel === "Hoje" && "border-border-strong",
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-baseline gap-2">
              <p className="text-sm font-bold">{day.relativeLabel ?? formatDayMonth(day.workDate)}</p>
              <p className="text-xs capitalize text-subtle">
                {day.relativeLabel ? formatDayMonth(day.workDate) : null} {day.weekday}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold">{formatMinutes(day.workedMinutes)}</p>
              <p className="text-xs font-semibold" style={{ color: toneColor(day.balanceMinutes >= 0 ? "success" : "danger") }}>
                {formatMinutes(day.balanceMinutes)}
              </p>
            </div>
          </div>

          <div className="mt-3">
            {day.hasRecord ? (
              <ul className="space-y-2">
                {day.entries.map((entry) => (
                  <li key={entry.id} className="flex flex-wrap items-center gap-2 text-sm">
                    {entry.kind === "entrada" ? (
                      <ArrowDownRight className="size-3.5 shrink-0 text-subtle" aria-hidden />
                    ) : (
                      <ArrowUpRight className="size-3.5 shrink-0 text-subtle" aria-hidden />
                    )}
                    <span className="font-semibold">{entry.kind === "entrada" ? "Entrada" : "Saída"}</span>
                    <span className="text-muted-foreground">{formatTime(entry.occurred_at)}</span>
                    {entry.is_edited ? <Badge variant="outline">Editado</Badge> : null}
                    {readOnly ? null : <EntryRowActions entry={entry} />}
                  </li>
                ))}
                {day.openSession ? <li className="text-xs text-subtle">Sessão em aberto.</li> : null}
              </ul>
            ) : (
              <p className="text-sm text-subtle">Sem registro</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
