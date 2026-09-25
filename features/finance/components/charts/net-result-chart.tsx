"use client";

import { CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard } from "@/features/finance/components/charts/chart-card";
import { formatCents, formatCentsCompact } from "@/features/finance/money";
import type { MonthlySummaryItem } from "@/features/finance/types";
import { CHART_AXIS_TICK, CHART_EXPENSE, CHART_GRID, CHART_INCOME, CHART_TOOLTIP_STYLE } from "@/lib/chart-colors";
import { formatMonthShort } from "@/lib/format";

/** Divide a série em dois traços (positivo/negativo) para a linha trocar de cor no cruzamento do zero. */
function withSignSplit(data: MonthlySummaryItem[]) {
  return data.map((item) => ({
    monthStart: item.monthStart,
    positive: item.netResult >= 0 ? item.netResult : null,
    negative: item.netResult < 0 ? item.netResult : null,
    netResult: item.netResult,
  }));
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value?: number }[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const value = payload[0]?.value ?? 0;
  return (
    <div style={CHART_TOOLTIP_STYLE}>
      <p className="mb-1 font-bold">{formatMonthShort(label ?? "")}</p>
      <p style={{ color: value >= 0 ? CHART_INCOME : CHART_EXPENSE }}>Resultado líquido: {formatCents(value)}</p>
    </div>
  );
}

export function NetResultChart({ data }: { data: MonthlySummaryItem[] }) {
  const chartData = withSignSplit(data);
  return (
    <ChartCard title="Evolução do resultado líquido" note="Últimos 12 e próximos 6 meses">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART_GRID} vertical={false} />
          <XAxis dataKey="monthStart" tickFormatter={formatMonthShort} tick={CHART_AXIS_TICK} axisLine={{ stroke: CHART_GRID }} tickLine={false} />
          <YAxis tickFormatter={formatCentsCompact} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} width={64} />
          <Tooltip content={<ChartTooltip />} />
          <ReferenceLine y={0} stroke="var(--border-strong)" strokeWidth={1.5} />
          <Line type="monotone" dataKey="positive" name="Positivo" stroke={CHART_INCOME} strokeWidth={2.5} dot={false} connectNulls={false} />
          <Line type="monotone" dataKey="negative" name="Negativo" stroke={CHART_EXPENSE} strokeWidth={2.5} dot={false} connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
