import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { AttentionDealItem } from "@/features/crm/types";

export function AttentionList({ items }: { items: AttentionDealItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-lg border border-dashed border-border-strong px-6 py-10 text-center">
        <CheckCircle2 className="mb-3 size-6 text-muted-foreground" aria-hidden />
        <p className="font-bold">Nenhum negócio parado.</p>
        <p className="mt-1 text-sm text-muted-foreground">Todo mundo com atividade recente ou próxima ação em dia.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-card">
      {items.map((item) => (
        <li key={item.id}>
          <Link href={`/crm?aba=leads&negocio=${item.id}`} className="flex flex-wrap items-center justify-between gap-2 p-4 transition-colors hover:bg-surface-raised">
            <span>
              <span className="block text-sm font-bold">{item.title}</span>
              <span className="block text-[13px] text-muted-foreground">{item.companyName}</span>
            </span>
            <span className="text-[13px] font-semibold text-muted-foreground">{item.reason}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
