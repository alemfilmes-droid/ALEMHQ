import Link from "next/link";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Landmark, Scale } from "lucide-react";
import { CARD_LINK_CLASS, CardContent, CardHeading } from "@/components/ui/card";
import { Metric, MetricGrid } from "@/components/ui/metric-value";
import { getHomeFinanceCard } from "@/features/finance/queries";

/**
 * Só é renderizado para quem tem a capability "finance". O card inteiro é o link. Os valores usam
 * <MetricValue> (via <Metric>): cada um na própria coluna, sem quebrar linha — encolhem com a coluna.
 */
export async function HomeFinanceCard() {
  const data = await getHomeFinanceCard();

  return (
    <Link href="/financeiro" className={CARD_LINK_CLASS}>
      <CardHeading icon={Landmark} tone="success" title="Financeiro" sensitive />
      <CardContent>
        <MetricGrid min="10rem">
          <Metric
            label="Em atraso"
            icon={AlertTriangle}
            value={data.overdue.total}
            format="cents"
            tone="danger"
            note={`${data.overdue.count} ${data.overdue.count === 1 ? "item" : "itens"}`}
          />
          <div className="min-w-0 space-y-2">
            <Metric label="Receber em 7 dias" icon={ArrowDownLeft} value={data.dueSoonIn} format="cents" size="sm" tone="success" />
            <Metric label="Pagar em 7 dias" icon={ArrowUpRight} value={data.dueSoonOut} format="cents" size="sm" tone="danger" />
          </div>
          <Metric
            label="Resultado do mês"
            icon={Scale}
            value={data.monthResult}
            format="cents"
            tone={data.monthResult >= 0 ? "success" : "danger"}
            note="Recebido − pago no mês"
          />
        </MetricGrid>
      </CardContent>
    </Link>
  );
}
