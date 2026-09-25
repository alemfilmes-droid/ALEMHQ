import { CalendarClock } from "lucide-react";
import { DirectionIcon } from "@/features/finance/components/status-badge";
import { EmptyState } from "@/features/finance/components/table-shell";
import { formatCents } from "@/features/finance/money";
import type { UpcomingItem } from "@/features/finance/types";
import { formatDate } from "@/lib/format";

export function UpcomingList({ items }: { items: UpcomingItem[] }) {
  if (items.length === 0) {
    return <EmptyState icon={CalendarClock} title="Nada vence nos próximos 30 dias." />;
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card">
      {items.map((item) => (
        <li key={`${item.direction}-${item.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4">
          <DirectionIcon direction={item.direction} />
          <span className="w-28 text-sm font-semibold tabular-nums">{formatDate(item.dueDate)}</span>
          <div className="min-w-0 flex-1 basis-48">
            <p className="truncate text-sm font-bold">{item.label}</p>
            <p className="truncate text-[13px] text-muted-foreground">
              {item.direction === "in" ? "Receber de" : "Pagar a"} {item.counterpart}
            </p>
          </div>
          <span className="text-sm font-bold tabular-nums">
            <span className="sr-only">{item.direction === "in" ? "Entrada de " : "Saída de "}</span>
            {item.direction === "in" ? "+ " : "− "}
            {formatCents(item.amount)}
          </span>
        </li>
      ))}
    </ul>
  );
}
