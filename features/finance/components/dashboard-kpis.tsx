import Link from "next/link";
import { AlertTriangle, ArrowDownLeft, CheckCircle2, Handshake, Scale, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCents } from "@/features/finance/money";
import { periodSearchParams, type Period } from "@/features/finance/period";
import type { DashboardKpis, NegotiationTotals } from "@/features/finance/types";
import { MetricValue, type MetricFormat } from "@/components/ui/metric-value";
import { MARGIN_STATUS_LABELS, MARGIN_STATUS_TONE, type StatusTone } from "@/lib/status";

interface Kpi {
  title: string;
  icon: LucideIcon;
  value: number | string | null;
  format?: MetricFormat;
  note?: string;
  tone?: StatusTone;
  href: string;
}

function financeHref(period: Period, extra: Record<string, string>) {
  const query = new URLSearchParams({ ...periodSearchParams(period), ...extra });
  return `/financeiro?${query.toString()}`;
}

/** Cartões compactos e de mesma altura; a cor mora no valor, nunca no fundo do cartão. Cada um é um link (drill-down). */
export function DashboardKpiRow({ kpis, period, negotiation }: { kpis: DashboardKpis; period: Period; negotiation: NegotiationTotals }) {
  const items: Kpi[] = [
    { title: "Faturamento no período", icon: Wallet, value: kpis.billed,
      format: "cents", href: financeHref(period, { aba: "recebimentos" }) },
    {
      title: "Recebido",
      icon: CheckCircle2,
      value: kpis.received,
      format: "cents",
      tone: "success",
      href: financeHref(period, { aba: "recebimentos", status: "recebido" }),
    },
    {
      title: "A receber",
      icon: ArrowDownLeft,
      value: kpis.toReceive,
      format: "cents",
      tone: "warning",
      href: financeHref(period, { aba: "recebimentos", status: "pendente,atrasado" }),
    },
    {
      title: "Custos fixos",
      icon: TrendingDown,
      value: kpis.fixedCosts,
      format: "cents",
      tone: "danger",
      href: financeHref(period, { aba: "pagamentos", fixo: "fixo" }),
    },
    {
      title: "Custos variáveis",
      icon: TrendingDown,
      value: kpis.variableCosts,
      format: "cents",
      tone: "danger",
      href: financeHref(period, { aba: "pagamentos", fixo: "variavel" }),
    },
    {
      title: "Resultado líquido",
      icon: kpis.netResult >= 0 ? TrendingUp : TrendingDown,
      value: kpis.netResult,
      format: "cents",
      tone: kpis.netResult >= 0 ? "success" : "danger",
      href: "#entradas-saidas-title",
    },
    {
      title: "Margem média",
      icon: Scale,
      value: kpis.averageMarginPct,
      format: "percent",
      note: kpis.averageMarginStatus ? MARGIN_STATUS_LABELS[kpis.averageMarginStatus] : undefined,
      tone: kpis.averageMarginStatus ? MARGIN_STATUS_TONE[kpis.averageMarginStatus] : undefined,
      href: "#margem-projeto-title",
    },
    {
      title: "Em negociação",
      icon: Handshake,
      value: negotiation.total,
      format: "cents",
      note: `${negotiation.count} ${negotiation.count === 1 ? "negócio" : "negócios"} · previsão ponderada ${formatCents(negotiation.weighted)}`,
      href: financeHref(period, { aba: "em-negociacao" }),
    },
    {
      title: "Em atraso",
      icon: AlertTriangle,
      value: kpis.overdue.total,
      format: "cents",
      note: `${kpis.overdue.count} ${kpis.overdue.count === 1 ? "item" : "itens"}`,
      tone: "danger",
      href: "#attention-now-title",
    },
  ];

  return (
    <section aria-label="Indicadores do período" className="card-grid">
      {items.map(({ title, icon: Icon, value, format, note, tone, href }) => (
        <Link
          key={title}
          href={href}
          className="block rounded-lg border border-border bg-card outline-none transition-colors hover:border-border-strong hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
            <Icon className="size-4 text-subtle" aria-hidden />
          </CardHeader>
          <CardContent>
            <MetricValue value={value} format={format} tone={tone} />
            {note ? <p className="mt-1 text-xs text-subtle">{note}</p> : null}
          </CardContent>
        </Link>
      ))}
    </section>
  );
}
