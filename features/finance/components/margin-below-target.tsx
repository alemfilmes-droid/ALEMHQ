import Link from "next/link";
import { TrendingDown } from "lucide-react";
import { CardContent, CardHeading } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import type { MarginBelowTargetItem } from "@/features/finance/queries";
import { formatPercent, type MarginThresholds } from "@/lib/margin";
import { toneColor } from "@/lib/status";

/**
 * Relatório mensal "Projetos abaixo da meta de margem": a faixa entre o crítico e a meta (30–40%),
 * que não dispara alerta imediato e é revisada no fechamento. A diretoria recebe o aviso no dia 1.
 */
export function MarginBelowTargetReport({ items, thresholds }: { items: MarginBelowTargetItem[]; thresholds: MarginThresholds }) {
  const warning = toneColor("warning");
  return (
    <section id="margem-abaixo-da-meta" aria-labelledby="margem-abaixo-da-meta-title" className="card-surface card-static scroll-mt-24 rounded-lg">
      <CardHeading
        icon={TrendingDown}
        tone="warning"
        title={<span id="margem-abaixo-da-meta-title">Projetos abaixo da meta de margem (fechamento mensal)</span>}
        sensitive
      />
      <CardContent className="space-y-3">
        <p className="text-[13px] text-muted-foreground">
          Margem entre {formatPercent(thresholds.attention)} e {formatPercent(thresholds.healthy)}: sem alerta imediato, revisados no fechamento do mês. Abaixo de{" "}
          {formatPercent(thresholds.attention)} a diretoria é avisada na hora.
        </p>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum projeto nesta faixa agora.</p>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border">
            {items.map((item) => (
              <li key={item.projectId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <Link href={`/projetos/${item.projectId}?aba=financeiro`} className="min-w-0 font-semibold hover:underline">
                  {item.projectName}
                  {item.companyName ? <span className="font-normal text-muted-foreground"> · {item.companyName}</span> : null}
                </Link>
                <span className="flex items-center gap-4 text-[13px] text-muted-foreground">
                  <span>
                    Contrato <Money cents={item.contractValue} /> · custos <Money cents={item.payablesTotal} />
                  </span>
                  <span data-sensitive="percent" className="font-bold tabular-nums" style={{ color: warning }}>
                    {formatPercent(item.marginPct)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </section>
  );
}
