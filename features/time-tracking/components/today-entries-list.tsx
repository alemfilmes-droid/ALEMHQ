import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { formatTime } from "@/features/time-tracking/format";
import type { TimeEntry } from "@/types";

export function TodayEntriesList({ entries }: { entries: TimeEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-subtle">Nenhum registro hoje ainda.</p>;
  }

  return (
    <ul className="space-y-1.5" aria-label="Registros de hoje">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-center gap-2 text-sm">
          {entry.kind === "entrada" ? (
            <ArrowDownRight className="size-3.5 shrink-0 text-subtle" aria-hidden />
          ) : (
            <ArrowUpRight className="size-3.5 shrink-0 text-subtle" aria-hidden />
          )}
          <span className="font-semibold">{entry.kind === "entrada" ? "Entrada" : "Saída"}</span>
          <span className="text-muted-foreground">{formatTime(entry.occurred_at)}</span>
          {entry.is_edited ? <span className="text-xs text-subtle">Editado</span> : null}
        </li>
      ))}
    </ul>
  );
}
