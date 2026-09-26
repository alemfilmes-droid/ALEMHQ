"use client";

import { Money } from "@/components/ui/money";
import { useRouter, useSearchParams } from "next/navigation";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard } from "@/features/finance/components/charts/chart-card";
import { formatCentsCompact } from "@/features/finance/money";
import type { MonthlySummaryItem } from "@/features/finance/types";
import { CHART_AXIS_TICK, CHART_EXPENSE, CHART_GRID, CHART_INCOME, CHART_NEUTRAL, CHART_TOOLTIP_STYLE } from "@/lib/chart-colors";
import { formatMonthShort } from "@/lib/format";

interface TooltipPayloadItem {
  color?: string;
  name?: string;
  value?: number;
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div style={CHART_TOOLTIP_STYLE}>
      <p className="mb-1 font-bold">{formatMonthShort(label ?? "")}</p>
      {payload.map((item) => (
        <p key={item.name} style={{ color: item.color }}>
          {item.name}: <Money cents={item.value ?? 0} />
        </p>
      ))}
    </div>
  );
}

/** Entradas x saídas nos últimos 12 meses, com o resultado líquido como linha neutra. Clicar num mês vai para o Dashboard filtrado nesse mês. */
export function IncomeExpenseChart({ data }: { data: MonthlySummaryItem[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function goToMonth(item: MonthlySummaryItem) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("aba", "dashboard");
    params.set("periodo", "personalizado");
    params.set("de", item.monthStart);
    params.set("ate", item.monthEnd);
    router.push(`/financeiro?${params.toString()}`);
  }

  return (
    <ChartCard title="Entradas x saídas" note="Últimos 12 meses · clique num mês para focar nele" titleId="entradas-saidas-title">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART_GRID} vertical={false} />
          <XAxis dataKey="monthStart" tickFormatter={formatMonthShort} tick={CHART_AXIS_TICK} axisLine={{ stroke: CHART_GRID }} tickLine={false} />
          <YAxis className="sensitive-axis" tickFormatter={formatCentsCompact} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} width={64} />
          <Tooltip content={<ChartTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
          <Bar
            dataKey="totalReceived"
            name="Entradas"
            fill={CHART_INCOME}
            radius={[3, 3, 0, 0]}
            style={{ cursor: "pointer" }}
            onClick={(entry: { payload: MonthlySummaryItem }) => goToMonth(entry.payload)}
          />
          <Bar
            dataKey="totalPaid"
            name="Saídas"
            fill={CHART_EXPENSE}
            radius={[3, 3, 0, 0]}
            style={{ cursor: "pointer" }}
            onClick={(entry: { payload: MonthlySummaryItem }) => goToMonth(entry.payload)}
          />
          <Line type="monotone" dataKey="netResult" name="Resultado líquido" stroke={CHART_NEUTRAL} strokeWidth={2} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
