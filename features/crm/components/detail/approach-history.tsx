"use client";

import { useEffect, useState } from "react";
import { approachHistoryAction, type ApproachHistoryEntry } from "@/features/crm/interaction-actions";
import { INTERACTION_CHANNEL_LABELS } from "@/features/crm/labels";
import { formatDateTime } from "@/lib/format";
import type { DealInteractionChannel } from "@/types";

const FIELD_LABELS: Record<string, string> = { channel: "Canal", occurred_at: "Data e horário", summary: "Observação" };

function show(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (field === "channel" && typeof value === "string") return INTERACTION_CHANNEL_LABELS[value as DealInteractionChannel] ?? value;
  if (field === "occurred_at" && typeof value === "string") return formatDateTime(value);
  return String(value);
}

/**
 * Histórico de uma abordagem (edições e risco). O banco só devolve o risco — motivo, quem e quando —
 * para a diretoria/admin.
 */
export function ApproachHistory({ interactionId }: { interactionId: string }) {
  const [entries, setEntries] = useState<ApproachHistoryEntry[] | null>(null);

  useEffect(() => {
    let active = true;
    approachHistoryAction(interactionId)
      .then((rows) => active && setEntries(rows))
      .catch(() => active && setEntries([]));
    return () => {
      active = false;
    };
  }, [interactionId]);

  if (entries === null) return <p className="text-[13px] text-muted-foreground">Carregando…</p>;
  if (entries.length === 0) return <p className="text-[13px] text-muted-foreground">Sem alterações registradas.</p>;

  return (
    <ol className="space-y-2">
      {entries.map((entry) => (
        <li key={entry.id} className="space-y-1 rounded-md border border-border p-2 text-[13px]">
          <p className="font-semibold">
            {entry.action === "DELETE" ? "Riscado" : "Editado"} por {entry.changedByName}
            <span className="font-normal text-muted-foreground"> · {formatDateTime(entry.changedAt)}</span>
          </p>
          {entry.action === "EDIT" ? (
            <ul className="space-y-0.5 break-words">
              {Object.entries(entry.changes).map(([field, change]) => (
                <li key={field}>
                  <span className="text-muted-foreground">{FIELD_LABELS[field] ?? field}:</span> {show(field, change.before)} →{" "}
                  <span className="font-semibold">{show(field, change.after)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {entry.reason ? <p className="text-muted-foreground">Motivo: {entry.reason}</p> : null}
        </li>
      ))}
    </ol>
  );
}
