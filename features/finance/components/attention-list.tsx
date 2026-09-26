import { Money } from "@/components/ui/money";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { DirectionIcon } from "@/features/finance/components/status-badge";
import type { AttentionItem } from "@/features/finance/types";
import { formatDate } from "@/lib/format";
import { toneColor } from "@/lib/status";

/** Recebimentos e pagamentos em atraso, do mais antigo para o mais recente. */
export function AttentionList({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-lg border border-dashed border-border-strong px-6 py-10 text-center">
        <CheckCircle2 className="mb-2 size-5 text-subtle" aria-hidden />
        <p className="font-bold">Nada em atraso agora.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card">
      {items.map((item) => (
        <li key={`${item.direction}-${item.id}`}>
          <Link href={item.href} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4 outline-none transition-colors hover:bg-surface-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
            <span className="inline-flex size-2 shrink-0 rounded-full" style={{ backgroundColor: toneColor("danger") }} aria-hidden />
            <DirectionIcon direction={item.direction} />
            <div className="min-w-0 flex-1 basis-48">
              <p className="truncate text-sm font-bold">{item.label}</p>
              <p className="truncate text-[13px] text-muted-foreground">
                {item.direction === "in" ? "Receber de" : "Pagar a"} {item.counterpart} · venceu em {formatDate(item.dueDate)}
              </p>
            </div>
            <span className="text-[13px] font-bold" style={{ color: toneColor("danger") }}>
              {item.daysOverdue} {item.daysOverdue === 1 ? "dia" : "dias"} em atraso
            </span>
            <span className="text-sm font-bold tabular-nums" style={{ color: toneColor("danger") }}>
              <Money cents={item.amount} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
