import { History } from "lucide-react";
import type { ProcessRunItem } from "@/features/processes/types";
import { formatDateTime } from "@/lib/format";

/** Execuções concluídas: quem rodou, quando, quanto tempo levou e quantos passos marcou. */
export function ProcessHistory({ runs, totalSteps }: { runs: ProcessRunItem[]; totalSteps: number }) {
  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-lg border border-dashed border-border-strong px-6 py-14 text-center">
        <History className="mb-3 size-6 text-muted-foreground" aria-hidden />
        <p className="font-bold">Nenhuma execução concluída ainda.</p>
        <p className="mt-1 text-sm text-muted-foreground">Execuções são opcionais. Quando alguém concluir uma, ela aparece aqui.</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {runs.map((run) => {
        const minutes = run.finishedAt ? Math.max(1, Math.round((Date.parse(run.finishedAt) - Date.parse(run.startedAt)) / 60000)) : null;
        const duration = minutes == null ? "" : minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, "0")}`;
        return (
          <li key={run.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
            <span className="min-w-0">
              <span className="font-semibold">{run.startedByName}</span>
              {run.contextLabel ? <span className="text-muted-foreground"> · {run.contextLabel}</span> : null}
            </span>
            <span className="text-[13px] text-muted-foreground">
              {run.finishedAt ? formatDateTime(run.finishedAt) : "—"}
              {duration ? ` · ${duration}` : ""} · {run.done.length}/{totalSteps} passos
            </span>
          </li>
        );
      })}
    </ul>
  );
}
