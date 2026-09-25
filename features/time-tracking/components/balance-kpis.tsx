import { Calendar, Clock, Scale, TrendingUp, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMinutes } from "@/features/time-tracking/format";
import type { BalanceKpis } from "@/features/time-tracking/types";
import { MetricValue, type MetricFormat } from "@/components/ui/metric-value";
import type { StatusTone } from "@/lib/status";

interface Kpi {
  title: string;
  icon: LucideIcon;
  value: number | string | null;
  format?: MetricFormat;
  tone?: StatusTone;
}

export function BalanceKpiRow({ kpis }: { kpis: BalanceKpis }) {
  const items: Kpi[] = [
    {
      title: "Saldo total",
      icon: Scale,
      value: formatMinutes(kpis.totalBalanceMinutes),
      tone: kpis.totalBalanceMinutes >= 0 ? "success" : "danger",
    },
    {
      title: "Saldo do mês",
      icon: TrendingUp,
      value: formatMinutes(kpis.monthBalanceMinutes),
      tone: kpis.monthBalanceMinutes >= 0 ? "success" : "danger",
    },
    { title: "Carga diária", icon: Clock, value: formatMinutes(Math.round(kpis.dailyHours * 60)) },
    { title: "Horas no mês", icon: Wallet, value: formatMinutes(kpis.workedThisMonthMinutes) },
    { title: "Dias trabalhados", icon: Calendar, value: kpis.daysWorkedThisMonth },
  ];

  return (
    <section aria-label="Indicadores do banco de horas" className="card-grid">
      {items.map(({ title, icon: Icon, value, format, tone }) => (
        <Card key={title}>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
            <Icon className="size-4 text-subtle" aria-hidden />
          </CardHeader>
          <CardContent>
            <MetricValue value={value} format={format} tone={tone} />
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
