import { ArrowDownLeft, CalendarCheck2, CheckCircle2, Handshake, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeading } from "@/components/ui/card";
import { MetricValue, type MetricFormat } from "@/components/ui/metric-value";
import type { PanelTone } from "@/lib/theme";
import type { StatusTone } from "@/lib/status";

interface Props {
  toReceiveCents: number;
  toReceiveCount: number;
  receivedMonthCents: number;
  receivedYearCents: number;
  monthLabel: string;
  year: string;
}

interface Kpi {
  title: string;
  icon: LucideIcon;
  iconTone: PanelTone;
  value: number | string;
  format: MetricFormat;
  tone?: StatusTone;
  note: string;
}

/** Mini dashboard da Carteira — os mesmos cards de indicador do Financeiro (CardHeading + MetricValue). */
export function WalletKpis({ toReceiveCents, toReceiveCount, receivedMonthCents, receivedYearCents, monthLabel, year }: Props) {
  const items: Kpi[] = [
    {
      title: "A receber",
      icon: ArrowDownLeft,
      iconTone: "warning",
      value: toReceiveCents,
      format: "cents",
      tone: toReceiveCents > 0 ? "warning" : undefined,
      note: toReceiveCount === 0 ? "Nada pendente" : toReceiveCount === 1 ? "1 lançamento" : `${toReceiveCount} lançamentos`,
    },
    { title: "Recebido no mês", icon: CheckCircle2, iconTone: "success", value: receivedMonthCents, format: "cents", tone: receivedMonthCents > 0 ? "success" : undefined, note: monthLabel },
    { title: "Recebido no ano", icon: CalendarCheck2, iconTone: "success", value: receivedYearCents, format: "cents", tone: receivedYearCents > 0 ? "success" : undefined, note: `Desde janeiro de ${year}` },
    { title: "Em negociação", icon: Handshake, iconTone: "neutral", value: "Em breve · CRM", format: "text", note: "Previsões dos negócios do CRM" },
  ];

  return (
    <section aria-label="Resumo da Carteira" className="kpi-rail">
      {items.map(({ title, icon, iconTone, value, format, tone, note }) => (
        <Card key={title} className="flex flex-col">
          <CardHeading icon={icon} tone={iconTone} title={title} className="p-5 pb-2" sensitive={format === "cents"} />
          <CardContent className="p-5 pt-0">
            {format === "text" ? (
              <p className="font-display text-lg font-black tracking-tight text-muted-foreground">{value}</p>
            ) : (
              <MetricValue value={value} format={format} size="md" tone={tone} />
            )}
            <p className="mt-1 text-xs text-subtle">{note}</p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
