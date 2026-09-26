import { AlertTriangle, ArrowDownLeft, ArrowUpRight, CheckCircle2, Scale, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeading } from "@/components/ui/card";
import { MetricValue } from "@/components/ui/metric-value";
import type { PeriodSummary } from "@/features/finance/types";

export function SummaryCards({ summary }: { summary: PeriodSummary }) {
  const cards: { title: string; icon: LucideIcon; value: number; note?: string }[] = [
    { title: "A receber no período", icon: ArrowDownLeft, value: summary.toReceive },
    { title: "Recebido no período", icon: CheckCircle2, value: summary.received },
    {
      title: "Em atraso",
      icon: AlertTriangle,
      value: summary.overdueReceivables.total,
      note: `${summary.overdueReceivables.count} ${summary.overdueReceivables.count === 1 ? "recebimento" : "recebimentos"}`,
    },
    { title: "A pagar no período", icon: ArrowUpRight, value: summary.toPay },
    { title: "Pago no período", icon: CheckCircle2, value: summary.paid },
    {
      title: "Saldo previsto do período",
      icon: Scale,
      value: summary.expectedBalance,
      note: "Recebido + a receber − pago − a pagar",
    },
  ];

  return (
    <section aria-label="Resumo do período" className="card-grid">
      {cards.map(({ title, icon: Icon, value, note }) => (
        <Card key={title}>
          <CardHeading icon={Icon} tone="success" title={title} className="pb-2" sensitive />
          <CardContent>
            <MetricValue value={value} format="cents" />
            {note ? <p className="mt-1 text-xs text-subtle">{note}</p> : null}
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
