"use client";

import { ProspectLeadCard } from "@/features/prospeccao/components/prospect-lead-card";
import type { ObjectionOption, QueueItem } from "@/features/prospeccao/types";

interface Props {
  items: QueueItem[];
  today: string;
  empty: string;
  canAct: boolean;
  objections: ObjectionOption[];
}

/** Leads da prospecção em cards de uma coluna (celular primeiro). */
export function ProspectQueue({ items, today, empty, canAct, objections }: Props) {
  if (items.length === 0) return <p className="rounded-lg border border-border p-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="grid gap-3">
      {items.map((item) => (
        <ProspectLeadCard key={item.dealId} item={item} today={today} canAct={canAct} objections={objections} />
      ))}
    </ul>
  );
}
