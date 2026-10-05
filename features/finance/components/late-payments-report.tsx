import Link from "next/link";
import { Clock3 } from "lucide-react";
import { CardContent, CardHeading } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import type { LatePaymentItem } from "@/features/finance/queries";
import { formatDate } from "@/lib/format";

/** Fechamento: cada pagamento feito com atraso, com dias, multa paga e o motivo — para ver o padrão. */
export function LatePaymentsReport({ items, monthLabel }: { items: LatePaymentItem[]; monthLabel: string }) {
  const penalties = items.reduce((total, item) => total + (item.penaltyAmount ?? 0), 0);
  return (
    <section id="pagamentos-com-atraso" aria-labelledby="late-payments-title" className="card-surface card-static scroll-mt-24 rounded-lg">
      <CardHeading icon={Clock3} tone="danger" title={<span id="late-payments-title">Pagamentos feitos com atraso · {monthLabel}</span>} sensitive />
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum pagamento com atraso neste mês.</p>
        ) : (
          <>
            <p className="text-[13px] text-muted-foreground">
              {items.length} {items.length === 1 ? "pagamento" : "pagamentos"} com atraso
              {penalties > 0 ? (
                <>
                  {" "}
                  · <Money cents={penalties} /> em multa/juros
                </>
              ) : null}
              .
            </p>
            <ul className="divide-y divide-border rounded-md border border-border">
              {items.map((item) => (
                <li key={item.payableId} className="space-y-0.5 px-4 py-3 text-sm">
                  <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <Link href={`/financeiro?aba=pagamentos&pagamento=${item.payableId}`} className="font-semibold hover:underline">
                      {item.payee} · {item.description}
                    </Link>
                    <span className="text-[13px] font-bold tabular-nums">
                      {item.daysLate} {item.daysLate === 1 ? "dia" : "dias"} de atraso
                    </span>
                  </p>
                  <p className="text-[13px] text-muted-foreground">
                    Vencia {formatDate(item.dueDate)}, pago {formatDate(item.paidAt)}
                    {item.projectName ? ` · ${item.projectName}` : ""}
                    {item.penaltyAmount != null ? (
                      <>
                        {" "}
                        · multa/juros <Money cents={item.penaltyAmount} />
                        {item.penaltyReason ? ` (${item.penaltyReason})` : ""}
                      </>
                    ) : null}
                  </p>
                  {item.lateReason ? <p className="text-[13px]">Motivo: {item.lateReason}</p> : null}
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </section>
  );
}
