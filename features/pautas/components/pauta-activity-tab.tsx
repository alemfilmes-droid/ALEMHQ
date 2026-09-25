import { History } from "lucide-react";
import type { PautaHistoryEntry } from "@/features/pautas/types";
import { PAUTA_STATUS_LABELS } from "@/lib/pautas";
import { formatDateTime } from "@/lib/format";
import type { PautaStatus } from "@/types";

function statusLabel(status: string | null) {
  return status ? PAUTA_STATUS_LABELS[status as PautaStatus] : null;
}

export function PautaActivityTab({ history }: { history: PautaHistoryEntry[] }) {
  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-lg border border-dashed border-border-strong px-6 py-12 text-center">
        <History className="mb-3 size-6 text-muted-foreground" aria-hidden />
        <p className="font-bold">Sem atividade registrada ainda.</p>
      </div>
    );
  }

  return (
    <ol className="space-y-4">
      {history.map((entry) => {
        const to = statusLabel(entry.to_status);
        const from = statusLabel(entry.from_status);
        return (
          <li key={entry.id} className="border-l-2 border-border-strong pl-4">
            <p className="text-sm">
              <span className="font-bold">{entry.changed_by_name ?? "Alguém"}</span>{" "}
              {from ? (
                <>
                  passou de <span className="font-semibold">{from}</span> para <span className="font-semibold">{to}</span>
                </>
              ) : (
                <>
                  criou a pauta como <span className="font-semibold">{to}</span>
                </>
              )}
              {entry.to_assignee_name ? (
                <>
                  {" "}
                  · responsável: <span className="font-semibold">{entry.to_assignee_name}</span>
                </>
              ) : null}
            </p>
            {entry.note ? <p className="mt-1 text-sm text-muted-foreground">“{entry.note}”</p> : null}
            <p className="mt-1 text-[12px] text-subtle">{formatDateTime(entry.created_at)}</p>
          </li>
        );
      })}
    </ol>
  );
}
