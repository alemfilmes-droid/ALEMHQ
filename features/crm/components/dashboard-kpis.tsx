import Link from "next/link";
import { CalendarCheck2, Handshake, Percent, Target, TrendingDown, TrendingUp, Wallet, XCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CARD_LINK_CLASS, CardContent, CardHeading } from "@/components/ui/card";
import type { DashboardKpis } from "@/features/crm/types";
import type { Period } from "@/features/finance/period";
import { periodSearchParams } from "@/features/finance/period";
import { MetricValue, type MetricFormat } from "@/components/ui/metric-value";
import type { StatusTone } from "@/lib/status";

interface Kpi {
  title: string;
  icon: LucideIcon;
  value: number | string | null;
  format?: MetricFormat;
  note?: string;
  tone?: StatusTone;
  href: string;
}

function crmHref(period: Period, extra: Record<string, string>) {
  const query = new URLSearchParams({ aba: "leads", ...periodSearchParams(period), ...extra });
  return `/crm?${query.toString()}`;
}

/** Cartões compactos de mesma altura; a cor mora no valor, nunca no fundo. Cada um é um link (drill-down). */
export function CrmDashboardKpiRow({ kpis, period }: { kpis: DashboardKpis; period: Period }) {
  const items: Kpi[] = [
    {
      title: "Leads abertos",
      icon: Target,
      value: kpis.openDeals,
      href: crmHref(period, {}),
    },
    {
      title: "Valor em negociação",
      icon: Wallet,
      value: kpis.valueInNegotiation,
      format: "cents",
      tone: "warning",
      href: crmHref(period, { etapa: "proposta_enviada,negociacao" }),
    },
    {
      title: "Reuniões no período",
      icon: CalendarCheck2,
      value: kpis.meetingsInPeriod,
      href: crmHref(period, { etapa: "reuniao_agendada,reuniao_realizada" }),
    },
    {
      title: "Ganhos no período",
      icon: Handshake,
      value: kpis.wonInPeriod,
      tone: "success",
      href: crmHref(period, { etapa: "ganho" }),
    },
    {
      title: "Perdidos no período",
      icon: XCircle,
      value: kpis.lostInPeriod,
      tone: "danger",
      href: crmHref(period, { etapa: "perdido" }),
    },
    {
      title: "Ticket médio",
      icon: kpis.averageTicket >= 0 ? TrendingUp : TrendingDown,
      value: kpis.averageTicket,
      format: "cents",
      href: crmHref(period, { etapa: "ganho" }),
    },
    {
      title: "Taxa de conversão",
      icon: Percent,
      value: kpis.conversionRate,
      format: "percent",
      note: "Ganhos ÷ (ganhos + perdidos)",
      href: "#funil-title",
    },
  ];

  return (
    <section aria-label="Indicadores do CRM" className="card-grid">
      {items.map(({ title, icon: Icon, value, format, note, tone, href }) => (
        <Link
          key={title}
          href={href}
          className={CARD_LINK_CLASS}
        >
          <CardHeading icon={Icon} tone="alert" title={title} className="pb-2" />
          <CardContent>
            <MetricValue value={value} format={format} tone={tone} />
            {note ? <p className="mt-1 text-xs text-subtle">{note}</p> : null}
          </CardContent>
        </Link>
      ))}
    </section>
  );
}
