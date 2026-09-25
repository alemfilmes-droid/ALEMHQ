"use client";

import { Area, CartesianGrid, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard } from "@/features/finance/components/charts/chart-card";
import { formatCents, formatCentsCompact } from "@/features/finance/money";
import type { CashFlowDay } from "@/features/finance/types";
import { CHART_AXIS_TICK, CHART_EXPENSE, CHART_GRID, CHART_INCOME, CHART_TOOLTIP_STYLE } from "@/lib/chart-colors";
import { formatDayShort } from "@/lib/format";

function withSignSplit(data: CashFlowDay[]) {
  return data.map((item) => ({
    day: item.day,
    positive: item.runningBalance >= 0 ? item.runningBalance : null,
    negative: item.runningBalance < 0 ? item.runningBalance : null,
    runningBalance: item.runningBalance,
  }));
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value?: number }[]; label?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  const value = payload[0]?.value ?? 0;
  return (
    <div style={CHART_TOOLTIP_STYLE}>
      <p className="mb-1 font-bold">{formatDayShort(label ?? "")}</p>
      <p style={{ color: value >= 0 ? CHART_INCOME : CHART_EXPENSE }}>Saldo acumulado: {formatCents(value)}</p>
    </div>
  );
}

/** Projeção de 90 dias: área verde enquanto o saldo acumulado é positivo, vermelha quando negativo. */
export function CashFlowChart({ data }: { data: CashFlowDay[] }) {
  const chartData = withSignSplit(data);
  return (
    <ChartCard title="Fluxo de caixa projetado" note="Próximos 90 dias · saldo acumulado">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={CHART_GRID} vertical={false} />
          <XAxis dataKey="day" tickFormatter={formatDayShort} tick={CHART_AXIS_TICK} axisLine={{ stroke: CHART_GRID }} tickLine={false} interval={9} />
          <YAxis tickFormatter={formatCentsCompact} tick={CHART_AXIS_TICK} axisLine={false} tickLine={false} width={64} />
          <Tooltip content={<ChartTooltip />} />
          <ReferenceLine y={0} stroke="var(--border-strong)" strokeWidth={1.5} />
          <Area type="monotone" dataKey="positive" name="Saldo positivo" stroke={CHART_INCOME} strokeWidth={2} fill={CHART_INCOME} fillOpacity={0.16} connectNulls={false} />
          <Area type="monotone" dataKey="negative" name="Saldo negativo" stroke={CHART_EXPENSE} strokeWidth={2} fill={CHART_EXPENSE} fillOpacity={0.16} connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
