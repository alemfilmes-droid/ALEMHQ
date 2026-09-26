import { Money } from "@/components/ui/money";
import type { ReactNode } from "react";
import { Gem, Layers, CircleDashed, TrendingUp, type LucideIcon } from "lucide-react";
import { CardIcon } from "@/components/ui/card";
import { toCents } from "@/features/finance/money";
import { TIER_LABELS } from "@/lib/domain";
import { cn } from "@/lib/utils";
import type { ClientTier } from "@/types";

export type TierColumnKey = ClientTier | "sem_nivel";

export const TIER_COLUMNS: readonly TierColumnKey[] = ["high_ticket", "mid_ticket", "low_ticket", "sem_nivel"];

const COLUMN_LABEL: Record<TierColumnKey, string> = { ...TIER_LABELS, sem_nivel: "Sem nível" };
const COLUMN_ICON: Record<TierColumnKey, LucideIcon> = { high_ticket: Gem, mid_ticket: TrendingUp, low_ticket: Layers, sem_nivel: CircleDashed };

interface TierColumnProps {
  tier: TierColumnKey;
  count: number;
  /** Soma dos contratos da coluna — só para quem tem acesso ao financeiro. */
  total?: number | null;
  children: ReactNode;
}

/** Coluna fixa do quadro de clientes por nível de ticket. Não é arrastável: o nível muda no cadastro. */
export function TierColumn({ tier, count, total, children }: TierColumnProps) {
  return (
    <section
      aria-label={`${COLUMN_LABEL[tier]}: ${count} ${count === 1 ? "cliente" : "clientes"}`}
      className={cn("flex min-w-0 snap-start flex-col rounded-lg border border-border bg-surface", tier === "sem_nivel" && "bg-surface-weekend")}
    >
      <header className="flex items-center justify-between gap-2 border-b border-border px-3 py-3">
        <span className="flex min-w-0 items-center gap-2.5">
          <CardIcon icon={COLUMN_ICON[tier]} tone={tier === "sem_nivel" ? "neutral" : "accent"} className="size-7" />
          <span className="truncate text-sm font-bold">{COLUMN_LABEL[tier]}</span>
          <span className="shrink-0 text-xs font-semibold tabular-nums text-subtle">{count}</span>
        </span>
        {total != null ? <span className="shrink-0 whitespace-nowrap text-xs font-bold tabular-nums text-muted-foreground"><Money cents={toCents(total)} /></span> : null}
      </header>
      <div className="space-y-3 p-3">{count === 0 ? <p className="px-1 py-6 text-center text-[12px] text-subtle">Nenhum cliente aqui.</p> : children}</div>
    </section>
  );
}

/**
 * Quadro de 3 colunas fixas (High, Mid, Low Ticket) + uma coluna mais estreita "Sem nível". No
 * celular as colunas rolam na horizontal; a partir de xl, cabem todas na largura.
 */
export function ClientTierBoard({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <div className="grid min-w-[980px] snap-x grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,0.72fr)] items-start gap-4 xl:min-w-0">{children}</div>
    </div>
  );
}
