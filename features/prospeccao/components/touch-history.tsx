"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { touchHistoryAction, type TouchHistoryItem } from "@/features/prospeccao/send-actions";
import { formatDateTime } from "@/lib/format";

/** Toques enviados (texto exato), recolhido; carrega só ao abrir. */
export function TouchHistory({ dealId }: { dealId: string }) {
  const [items, setItems] = useState<TouchHistoryItem[] | null>(null);

  return (
    <details
      className="group rounded-md border border-border"
      onToggle={(event) => {
        if ((event.currentTarget as HTMLDetailsElement).open && items === null) void touchHistoryAction(dealId).then(setItems);
      }}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <History className="size-4" aria-hidden />
        Histórico de toques
      </summary>
      <div className="border-t border-border px-3 py-2">
        {items === null ? (
          <p className="py-2 text-[13px] text-muted-foreground">Carregando…</p>
        ) : items.length === 0 ? (
          <p className="py-2 text-[13px] text-muted-foreground">Nenhum toque enviado ainda.</p>
        ) : (
          <ol className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="space-y-1 py-2">
                <p className="text-[13px] font-semibold text-foreground">
                  {item.touchNumber === null ? "Reativação" : `Toque ${item.touchNumber}`}
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · {formatDateTime(item.sentAt)}
                    {item.sentBy ? ` · ${item.sentBy}` : ""}
                  </span>
                </p>
                <p className="whitespace-pre-wrap break-words text-[13px] text-muted-foreground">{item.text}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </details>
  );
}
